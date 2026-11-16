import { expect, type Page } from '@playwright/test'
import { LoginPage } from '../pages/login.page'
import { getQaEnv, authBlockedMessage } from './env'

export async function loginAsOwner(page: Page): Promise<void> {
  const env = getQaEnv()
  if (!env.authReady) {
    throw new Error(authBlockedMessage())
  }
  const login = new LoginPage(page)
  await login.goto()
  await login.login(env.email, env.password)
  await expect(page).toHaveURL(/dashboard|sales|hr|staff|inventory|products/i, {
    timeout: 45_000,
  })
}

export async function loginExpectFailure(page: Page, email: string, password: string) {
  await page.goto('/admin/login')
  await page.getByLabel(/username or email|email/i).fill(email)
  await page.getByLabel(/^password$/i).fill(password)
  await page.getByRole('button', { name: /sign in|log in|login/i }).click()
  // Stay on login or show error — never land on dashboard with bad password
  await page.waitForTimeout(1500)
  const url = page.url()
  expect(url).toMatch(/admin\/login|login/i)
}

export function requireMutatingAllowed(): void {
  const env = getQaEnv()
  if (!env.mutatingAllowed) {
    throw new Error(
      'MUTATION BLOCKED: set TEST_ENVIRONMENT_ID to a non-production id and ALLOW_MUTATING_E2E=true',
    )
  }
}
