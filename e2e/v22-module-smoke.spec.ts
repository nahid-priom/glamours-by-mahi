import { expect, test } from '@playwright/test'
import { LoginPage } from './pages/login.page'

const email =
  process.env.E2E_ADMIN_EMAIL ??
  process.env.E2E_OWNER_EMAIL ??
  process.env.E2E_EMAIL
const password =
  process.env.E2E_ADMIN_PASSWORD ??
  process.env.E2E_OWNER_PASSWORD ??
  process.env.E2E_PASSWORD

const ROUTES: Array<{ path: string; assert: RegExp }> = [
  { path: '/dashboard', assert: /Today'?s Sales|Sales \(|Good (Morning|Afternoon|Evening)/i },
  { path: '/sales/pos', assert: /POS|Search product|barcode|New Sale|All Products/i },
  { path: '/hr/employees', assert: /Employee/i },
  { path: '/hr/employees/new', assert: /Employee|Create|New/i },
  { path: '/hr/commissions', assert: /Commission/i },
  { path: '/hr/payroll/advances', assert: /Advance|loan/i },
  { path: '/administration/targets', assert: /Target|Order count/i },
  { path: '/administration/permissions', assert: /Permission/i },
  { path: '/administration/roles', assert: /Role/i },
  { path: '/administration/activity', assert: /Activity/i },
  { path: '/accounts/reconciliation', assert: /Reconcil/i },
]

test.describe('V2.3 authenticated module smoke', () => {
  test.skip(!email || !password, 'Set E2E credentials')
  test.setTimeout(180_000)

  test('super admin shells load; My Workspace hidden; employee detail tabs', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.login(email!, password!)
    await expect(page).toHaveURL(/dashboard|sales|hr/i, { timeout: 30_000 })

    await page.goto('/dashboard')
    await expect(page.locator('aside').getByText('My Workspace')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Last 7 Days' })).toBeVisible({
      timeout: 45_000,
    })

    for (const route of ROUTES) {
      await page.goto(route.path)
      await expect(page.getByText(route.assert).first()).toBeAttached({ timeout: 45_000 })
      await page.screenshot({
        path: `docs/finalization/screenshots/v23/${route.path.replace(/\//g, '_').replace(/^_/, '') || 'root'}.png`,
        fullPage: true,
      })
    }

    await page.goto('/hr/employees')
    const firstEmployeeLink = page.locator('a[href*="/hr/employees/"]').filter({
      hasNot: page.locator('[href$="/new"]'),
    }).first()
    if (await firstEmployeeLink.count()) {
      await firstEmployeeLink.click()
      await expect(page.getByText(/Overview|Attendance|Commission|Activity/i).first()).toBeAttached({
        timeout: 45_000,
      })
      await page.screenshot({
        path: 'docs/finalization/screenshots/v23/hr_employees_detail.png',
        fullPage: true,
      })
    }
  })
})
