import { expect, test } from '@playwright/test'
import { LoginPage } from './pages/login.page'
import path from 'node:path'

const email =
  process.env.E2E_ADMIN_EMAIL ??
  process.env.E2E_OWNER_EMAIL ??
  process.env.E2E_EMAIL
const password =
  process.env.E2E_ADMIN_PASSWORD ??
  process.env.E2E_OWNER_PASSWORD ??
  process.env.E2E_PASSWORD

const VIEWPORTS = [
  { name: '360', width: 360, height: 800 },
  { name: '390', width: 390, height: 844 },
  { name: '430', width: 430, height: 932 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 768 },
  { name: '1366', width: 1366, height: 768 },
  { name: '1440', width: 1440, height: 900 },
  { name: '1920', width: 1920, height: 1080 },
] as const

const ROUTES = [
  { slug: 'dashboard', path: '/dashboard', assert: /Good (Morning|Afternoon|Evening)|Today'?s Sales/i },
  { slug: 'pos', path: '/sales/pos', assert: /POS|New Sale|Search product|barcode/i },
  { slug: 'employees', path: '/hr/employees', assert: /Employee/i },
  { slug: 'commissions', path: '/hr/commissions', assert: /Commission/i },
  { slug: 'activity', path: '/administration/activity', assert: /Activity/i },
  { slug: 'advances', path: '/hr/payroll/advances', assert: /Advance|loan/i },
] as const

test.describe('V2.1 visual QA screenshots', () => {
  test.skip(!email || !password, 'Set E2E credentials to run visual QA')
  test.setTimeout(300_000)

  test('multi-viewport authenticated shells', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.login(email!, password!)
    await expect(page).toHaveURL(/dashboard|sales|hr/i, { timeout: 30_000 })

    // Super Admin must not see My Workspace
    await page.goto('/dashboard')
    await expect(page.locator('aside').getByText('My Workspace')).toHaveCount(0)

    for (const route of ROUTES) {
      for (const vp of VIEWPORTS) {
        await page.setViewportSize({ width: vp.width, height: vp.height })
        await page.goto(route.path)
        await expect(page).toHaveURL(new RegExp(route.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
        // Mobile shells may clip headings; require DOM presence rather than layout visibility.
        await expect(page.getByText(route.assert).first()).toBeAttached({ timeout: 45_000 })
        await page.waitForTimeout(400)
        const out = path.join(
          'docs/finalization/screenshots/v21',
          `${route.slug}-${vp.name}.png`,
        )
        await page.screenshot({ path: out, fullPage: true })
      }
    }
  })
})
