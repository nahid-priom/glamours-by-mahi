import { expect, test } from '@playwright/test'
import { getQaEnv, authBlockedMessage } from '../helpers/env'
import { loginAsOwner, loginExpectFailure } from '../helpers/auth'

const env = getQaEnv()

test.describe('Authentication — Owner', () => {
  test('OWNER credentials prerequisite', async () => {
    expect(env.authReady, authBlockedMessage()).toBe(true)
  })

  test('valid Owner login reaches admin shell', async ({ page }) => {
    test.skip(!env.authReady, authBlockedMessage())
    await loginAsOwner(page)
    await expect(page.locator('body')).toBeVisible()
  })

  test('invalid password stays on login', async ({ page }) => {
    test.skip(!env.authReady, authBlockedMessage())
    await loginExpectFailure(page, env.email, 'definitely-wrong-password-xxx')
  })

  test('missing email does not navigate to dashboard', async ({ page }) => {
    await page.goto('/admin/login')
    await page.getByLabel(/^password$/i).fill('x')
    await page.getByRole('button', { name: /sign in|log in|login/i }).click()
    await expect(page).toHaveURL(/admin\/login/)
  })

  test('redirect to intended page after login via state.from deep link', async ({ page }) => {
    test.skip(!env.authReady, authBlockedMessage())
    await page.goto('/sales/pos')
    await page.waitForURL(/admin\/login/, { timeout: 30_000 })
    await page.getByLabel(/username or email|email/i).fill(env.email)
    await page.getByLabel(/^password$/i).fill(env.password)
    await page.getByRole('button', { name: /sign in|log in|login/i }).click()
    await expect(page).toHaveURL(/sales\/pos|dashboard/i, { timeout: 45_000 })
  })
})
