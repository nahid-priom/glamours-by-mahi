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

const OUT = 'docs/finalization/dashboard-v31/screenshots'

const VIEWPORTS = [
  { name: '360', width: 360, height: 800 },
  { name: '390', width: 390, height: 844 },
  { name: '430', width: 430, height: 932 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 768 },
  { name: '1366', width: 1366, height: 768 },
  { name: '1440', width: 1440, height: 900 },
  { name: '1920', width: 1920, height: 1080 },
]

test.describe('Dashboard V3.1 visual', () => {
  test.skip(!email || !password, 'Set E2E credentials')
  test.setTimeout(240_000)

  test('authenticated dashboard multi-viewport captures', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.login(email!, password!)
    await expect(page).toHaveURL(/dashboard|sales|hr/i, { timeout: 30_000 })

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('/dashboard')
      await expect(page.getByRole('button', { name: 'Last 7 Days' })).toBeVisible({
        timeout: 45_000,
      })
      // Horizontal KPI structure: Sales label visible
      await expect(page.getByText(/Today'?s Sales|Sales \(/i).first()).toBeVisible()
      await page.screenshot({
        path: path.join(OUT, `dashboard-${vp.name}.png`),
        fullPage: true,
      })
    }

    // Custom range persistence
    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto('/dashboard?date_from=2026-11-01&date_to=2026-11-07')
    await expect(page.getByText(/Sales \(/i).first()).toBeVisible({ timeout: 45_000 })
    await page.reload()
    await expect(page).toHaveURL(/date_from=2026-11-01/)
    await page.screenshot({
      path: path.join(OUT, 'dashboard-custom-range.png'),
      fullPage: true,
    })
  })
})
