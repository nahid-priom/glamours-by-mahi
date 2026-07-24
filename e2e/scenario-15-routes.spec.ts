import { test, expect } from '@playwright/test'

const publicRoutes = ['/', '/login']

const protectedRouteSamples = [
  '/dashboard',
  '/sales/pos',
  '/inventory/stock',
  '/couriers/settlements',
  '/customers',
  '/purchases',
]

test.describe('Scenario 15: viewport and route smoke', () => {
  for (const path of publicRoutes) {
    test(`public route loads ${path}`, async ({ page }) => {
      const res = await page.goto(path)
      expect(res?.status()).toBeLessThan(500)
      await expect(page.locator('body')).toBeVisible()
    })
  }

  for (const path of protectedRouteSamples) {
    test(`protected route redirects or loads ${path}`, async ({ page }) => {
      await page.goto(path)
      await expect(page.locator('body')).toBeVisible()
      const url = page.url()
      const onLogin = url.includes('/login')
      const onApp = protectedRouteSamples.some((p) => url.includes(p.replace(/^\//, '')))
      expect(onLogin || onApp).toBeTruthy()
    })
  }

  test('mobile viewport renders login shell', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/login')
    await expect(page.locator('body')).toBeVisible()
  })
})
