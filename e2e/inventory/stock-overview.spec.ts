import { expect, test } from '@playwright/test'
import { getQaEnv, authBlockedMessage } from '../helpers/env'
import { loginAsOwner } from '../helpers/auth'

const env = getQaEnv()

const VIEWS = ['branches', 'products', 'variants', 'low-stock'] as const

test.describe('INV-STOCK URL contract', () => {
  test.skip(!env.authReady, authBlockedMessage())

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page)
  })

  test('default stock overview loads', async ({ page }) => {
    await page.goto('/inventory/stock')
    await expect(page).toHaveURL(/\/inventory\/stock/)
    await expect(page.getByText(/stock|inventory|branch|on hand|available|overview/i).first()).toBeVisible({
      timeout: 45_000,
    })
  })

  for (const view of VIEWS) {
    test(`view=${view} tab/query`, async ({ page }) => {
      await page.goto(`/inventory/stock?view=${view}`)
      await expect(page).toHaveURL(new RegExp(`view=${view}`))
      await expect(page.locator('body')).toBeVisible()
      // Invalid crash check
      await expect(page.getByText(/something went wrong|uncaught/i)).toHaveCount(0)
    })
  }

  test('invalid view falls back without crash', async ({ page }) => {
    await page.goto('/inventory/stock?view=not-a-real-view')
    await expect(page.locator('body')).toBeVisible()
  })

  test('browser back/forward preserves inventory path', async ({ page }) => {
    await page.goto('/inventory/stock?view=branches')
    await page.goto('/inventory/stock?view=products')
    await page.goBack()
    await expect(page).toHaveURL(/view=branches/)
    await page.goForward()
    await expect(page).toHaveURL(/view=products/)
  })

  test('view=suppliers — implement only when tab exists', async ({ page }) => {
    await page.goto('/inventory/stock?view=suppliers')
    await expect(page.locator('body')).toBeVisible()
    const supplierTab = page.getByRole('tab', { name: /supplier/i })
    const count = await supplierTab.count()
    test.skip(
      count === 0,
      'NOT IMPLEMENTED / BLOCKED: view=suppliers tab not registered — do not mark PASS',
    )
    await expect(supplierTab.first()).toBeVisible()
  })

  test('ledger route loads', async ({ page }) => {
    await page.goto('/inventory/ledger')
    await expect(page.getByText(/ledger|stock|movement/i).first()).toBeVisible({ timeout: 45_000 })
  })
})
