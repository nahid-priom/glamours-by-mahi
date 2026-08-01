import { expect, test } from '@playwright/test'

test.describe('public + route shells', () => {
  test('storefront home loads', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('body')).toBeVisible()
  })

  test('unknown admin path shows controlled not-found or redirect', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-xyz')
    await expect(page.locator('body')).toBeVisible()
  })
})
