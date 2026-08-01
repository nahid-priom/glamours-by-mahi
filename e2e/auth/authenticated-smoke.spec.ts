import { expect, test } from '@playwright/test'
import { LoginPage } from '../pages/login.page'

const email = process.env.E2E_OWNER_EMAIL ?? process.env.E2E_EMAIL
const password = process.env.E2E_OWNER_PASSWORD ?? process.env.E2E_PASSWORD

test.describe('authenticated critical paths', () => {
  test.skip(!email || !password, 'Set E2E_OWNER_EMAIL and E2E_OWNER_PASSWORD to run authenticated e2e')

  test('login lands on dashboard shell', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.login(email!, password!)
    await expect(page).toHaveURL(/dashboard|sales|hr/i, { timeout: 30_000 })
    await expect(page.locator('body')).toBeVisible()
  })

  test('unauthorized deep route does not crash', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.login(email!, password!)
    await page.goto('/settings/data-reset')
    await expect(page.locator('body')).toBeVisible()
  })
})
