import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, devices } from '@playwright/test'

/** Load gitignored local e2e secrets without committing them. */
function loadEnvFile(name: string) {
  const path = resolve(process.cwd(), name)
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

loadEnvFile('.env.e2e.local')
loadEnvFile('.env.local')
loadEnvFile('test-results/cashier.env')

// Normalize OWNER_* aliases for legacy E2E_* consumers
if (process.env.OWNER_EMAIL && !process.env.E2E_OWNER_EMAIL) {
  process.env.E2E_OWNER_EMAIL = process.env.OWNER_EMAIL
}
if (process.env.OWNER_PASSWORD && !process.env.E2E_OWNER_PASSWORD) {
  process.env.E2E_OWNER_PASSWORD = process.env.OWNER_PASSWORD
}

const baseURL =
  process.env.E2E_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173'

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'test-results/playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/junit-playwright.xml' }],
    ['json', { outputFile: 'test-results/playwright-results.json' }],
  ],
  outputDir: 'test-results/playwright-output',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
    { name: 'w360', use: { browserName: 'chromium', viewport: { width: 360, height: 800 } } },
    { name: 'w430', use: { browserName: 'chromium', viewport: { width: 430, height: 900 } } },
    { name: 'w768', use: { browserName: 'chromium', viewport: { width: 768, height: 900 } } },
    { name: 'w1024', use: { browserName: 'chromium', viewport: { width: 1024, height: 900 } } },
  ],
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
