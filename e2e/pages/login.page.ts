import type { Page } from '@playwright/test'

export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/admin/login')
  }

  async login(email: string, password: string) {
    await this.page.getByLabel(/username or email|email/i).fill(email)
    await this.page.getByLabel(/^password$/i).fill(password)
    await this.page.getByRole('button', { name: /sign in|log in|login/i }).click()
    await this.page.waitForURL(/dashboard|sales|hr|staff/i, { timeout: 45_000 })
  }
}
