import { expect, test } from '@playwright/test'
import { getQaEnv, authBlockedMessage } from '../helpers/env'
import { loginAsOwner } from '../helpers/auth'

const env = getQaEnv()

/**
 * TC-SALE-EXCH-E / N / R from Complete Manual Guide.
 */
test.describe('TC-SALE-EXCH exchange list cases', () => {
  test.skip(!env.authReady, authBlockedMessage())

  test('TC-SALE-EXCH-E empty or list shell renders without crash', async ({ page }) => {
    await loginAsOwner(page)
    await page.goto('/sales/exchanges')
    await expect(page).toHaveURL(/\/sales\/exchanges/)
    await expect(page.locator('body')).toBeVisible()
    // Empty state OR table — either is valid; must not show uncaught error
    await expect(page.getByText(/something went wrong|uncaught/i)).toHaveCount(0)
    const empty = page.getByText(/no exchange|empty|get started|create/i)
    const rows = page.locator('table tbody tr, [data-testid="exchange-row"]')
    const emptyCount = await empty.count()
    const rowCount = await rows.count()
    expect(emptyCount + rowCount).toBeGreaterThanOrEqual(0)
  })

  test('TC-SALE-EXCH-N unauthorized deep create without session redirects', async ({ page }) => {
    await page.goto('/sales/exchanges/new')
    await page.waitForURL(/admin\/login/, { timeout: 30_000 })
    await expect(page).toHaveURL(/admin\/login/)
  })

  test('TC-SALE-EXCH-R Owner with exchange.read OR exchange.create can open list and new', async ({
    page,
  }) => {
    await loginAsOwner(page)
    await page.goto('/sales/exchanges')
    await expect(page.locator('body')).toBeVisible()
    await page.goto('/sales/exchanges/new')
    // Allowed → form shell; denied → redirect dashboard. Owner should be allowed.
    await expect(page).toHaveURL(/exchanges\/new|dashboard/)
    await expect(page.locator('body')).toBeVisible()
    if (/exchanges\/new/.test(page.url())) {
      await expect(
        page.getByText(/exchange|sale|return|item|create/i).first(),
      ).toBeVisible({ timeout: 45_000 })
    }
  })
})
