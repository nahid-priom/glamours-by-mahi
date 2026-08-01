import { expect, test } from '@playwright/test'
import { LoginPage } from '../pages/login.page'

test.describe('auth gate', () => {
  test('protected dashboard redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/login/i)
  })

  test('login page renders email and password fields', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
  })

  test('activity logs path is gated (redirects when logged out)', async ({ page }) => {
    await page.goto('/activity-logs')
    await expect(page).toHaveURL(/login/i)
  })
})
