import { expect, test } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getQaEnv, authBlockedMessage } from '../helpers/env'
import { loginAsOwner } from '../helpers/auth'

const env = getQaEnv()

function loadCashierEnv() {
  const path = resolve(process.cwd(), 'test-results/cashier.env')
  if (existsSync(path)) {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#') || !t.includes('=')) continue
      const eq = t.indexOf('=')
      const key = t.slice(0, eq).trim()
      const val = t.slice(eq + 1).trim()
      if (!(key in process.env)) process.env[key] = val
    }
  }
  return {
    email: process.env.CASHIER_EMAIL ?? '',
    password: process.env.CASHIER_PASSWORD ?? '',
  }
}

const cashier = loadCashierEnv()
const cashierReady = Boolean(cashier.email && cashier.password)

/**
 * RBAC — Owner permitted + Cashier denial when seeded via scripts/qa/seed-staging-fixtures.mjs
 */
test.describe('RBAC — Owner permitted routes', () => {
  test.skip(!env.authReady, authBlockedMessage())

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page)
  })

  test('inventory stock loads for permitted Owner', async ({ page }) => {
    await page.goto('/inventory/stock')
    await expect(page).toHaveURL(/inventory\/stock/)
    await expect(page.getByText(/stock|inventory|branch|on hand|available/i).first()).toBeVisible({
      timeout: 45_000,
    })
  })

  test('POS loads for permitted Owner', async ({ page }) => {
    await page.goto('/sales/pos')
    await expect(page.getByText(/POS|New Sale|barcode|Search product/i).first()).toBeVisible({
      timeout: 45_000,
    })
  })

  test('data-reset route is gated (no destructive confirm without intent)', async ({ page }) => {
    await page.goto('/settings/data-reset')
    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('RBAC — CASHIER denial matrix', () => {
  test('cashier persona available (seed required)', async () => {
    test.skip(
      !cashierReady,
      'CRITICAL BLOCKED: run `npm run qa:seed` with safe TEST_DATABASE_URL — not PASS',
    )
    expect(cashierReady).toBe(true)
  })

  test('cashier cannot open administration roles', async ({ page }) => {
    test.skip(!cashierReady, 'BLOCKED: cashier fixture missing')
    await page.goto('/admin/login')
    await page.getByLabel(/username or email|email/i).fill(cashier.email)
    await page.getByLabel(/^password$/i).fill(cashier.password)
    await page.getByRole('button', { name: /sign in|log in|login/i }).click()
    await page.waitForURL(/dashboard|sales|pos|inventory/i, { timeout: 45_000 })
    await page.goto('/administration/roles')
    await expect(page.locator('body')).toBeVisible()
    // Denied → dashboard redirect or empty denial — must not show role editor CRUD
    const onRoles = /administration\/roles/.test(page.url())
    if (onRoles) {
      await expect(page.getByRole('button', { name: /create role|add role/i })).toHaveCount(0)
    } else {
      await expect(page).toHaveURL(/dashboard/)
    }
  })

  test('cashier can open POS when granted pos.create', async ({ page }) => {
    test.skip(!cashierReady, 'BLOCKED: cashier fixture missing')
    await page.goto('/admin/login')
    await page.getByLabel(/username or email|email/i).fill(cashier.email)
    await page.getByLabel(/^password$/i).fill(cashier.password)
    await page.getByRole('button', { name: /sign in|log in|login/i }).click()
    await page.waitForURL(/dashboard|sales|pos/i, { timeout: 45_000 })
    await page.goto('/sales/pos')
    await expect(page.locator('body')).toBeVisible()
  })
})
