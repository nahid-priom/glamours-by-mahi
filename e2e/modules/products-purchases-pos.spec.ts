import { expect, test } from '@playwright/test'
import { getQaEnv, authBlockedMessage } from '../helpers/env'
import { loginAsOwner } from '../helpers/auth'

const env = getQaEnv()

test.describe('Module E2E — products / purchases / POS', () => {
  test.skip(!env.authReady, authBlockedMessage())

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page)
  })

  test('products list + new + import + categories shells', async ({ page }) => {
    for (const path of [
      '/products',
      '/products/new',
      '/products/import',
      '/products/categories',
      '/products/brands',
      '/products/variants',
    ]) {
      await page.goto(path)
      await expect(page.locator('body')).toBeVisible()
    }
  })

  test('purchases list + new + returns + payments shells', async ({ page }) => {
    for (const path of ['/purchases', '/purchases/new', '/purchases/returns', '/purchases/payments']) {
      await page.goto(path)
      await expect(page.locator('body')).toBeVisible()
    }
  })

  test('POS + held + sales history shells', async ({ page }) => {
    for (const path of ['/sales/pos', '/sales/held', '/sales']) {
      await page.goto(path)
      await expect(page.locator('body')).toBeVisible()
    }
  })
})
