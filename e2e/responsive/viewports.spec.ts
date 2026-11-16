import { expect, test } from '@playwright/test'
import { getQaEnv, authBlockedMessage } from '../helpers/env'
import { loginAsOwner } from '../helpers/auth'

const env = getQaEnv()
const WIDTHS = [360, 390, 430, 768, 1024, 1440] as const
const SMOKE_PATHS = ['/dashboard', '/sales/pos', '/inventory/stock', '/products']

test.describe('Responsive viewports', () => {
  // Run under a single Playwright project (orchestrator uses --project=desktop)
  // and vary viewport inside the test to avoid project×width login storms.
  test('public shop across required widths', async ({ page }) => {
    test.setTimeout(120_000)
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/shop')
      await expect(page.locator('body')).toBeVisible()
    }
  })

  test('authenticated critical shells across required widths', async ({ page }) => {
    test.skip(!env.authReady, authBlockedMessage())
    test.setTimeout(180_000)
    await loginAsOwner(page)
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 })
      for (const path of SMOKE_PATHS) {
        await page.goto(path)
        await expect(page.locator('body')).toBeVisible({ timeout: 45_000 })
      }
    }
  })
})
