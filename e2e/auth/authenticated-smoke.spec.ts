import { expect, test } from '@playwright/test'
import { LoginPage } from '../pages/login.page'

const email =
  process.env.E2E_ADMIN_EMAIL ??
  process.env.E2E_OWNER_EMAIL ??
  process.env.E2E_EMAIL
const password =
  process.env.E2E_ADMIN_PASSWORD ??
  process.env.E2E_OWNER_PASSWORD ??
  process.env.E2E_PASSWORD

test.describe('authenticated critical paths', () => {
  test.skip(!email || !password, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD (or E2E_OWNER_*) to run authenticated e2e')

  test('login lands on dashboard shell', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.login(email!, password!)
    await expect(page).toHaveURL(/dashboard|sales|hr/i, { timeout: 30_000 })
    await expect(page.locator('body')).toBeVisible()
  })

  test('dashboard and POS shells render after login', async ({ page }) => {
    test.setTimeout(90_000)
    const login = new LoginPage(page)
    await login.goto()
    await login.login(email!, password!)
    await page.goto('/dashboard')
    await expect(page.getByText(/Today'?s Sales|Sales \(|Collection|Net Profit|Dashboard/i).first()).toBeVisible({
      timeout: 45_000,
    })
    // Super Admin / Owner must not see personal My Workspace nav
    await expect(page.locator('aside').getByText('My Workspace')).toHaveCount(0)
    await page.screenshot({
      path: 'docs/finalization/screenshots/dashboard-1366.png',
      fullPage: true,
    })

    await page.goto('/sales/pos')
    await expect(page.getByText(/POS|New Sale|barcode|Search product/i).first()).toBeVisible({
      timeout: 45_000,
    })
    await page.screenshot({
      path: 'docs/finalization/screenshots/pos-1366.png',
      fullPage: true,
    })

    await page.goto('/administration/activity')
    await expect(page.getByText(/Activity/i).first()).toBeVisible({ timeout: 45_000 })
    await page.screenshot({
      path: 'docs/finalization/screenshots/activity-1366.png',
      fullPage: true,
    })
  })

  test('unauthorized deep route does not crash', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.login(email!, password!)
    await page.goto('/settings/data-reset')
    await expect(page.locator('body')).toBeVisible()
  })
})
