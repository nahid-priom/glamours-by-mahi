import { expect, test } from '@playwright/test'
import { getQaEnv, authBlockedMessage } from '../helpers/env'
import { loginAsOwner, requireMutatingAllowed } from '../helpers/auth'
import { dbReady, query } from '../helpers/db'

const env = getQaEnv()
const canDb = dbReady()

test.describe('Branch-First release QA', () => {
  test.skip(!env.authReady, authBlockedMessage())

  test('admin products listing loads with branch stock copy', async ({ page }) => {
    await loginAsOwner(page)
    await page.goto('/products')
    await expect(page.locator('body')).toBeVisible()
    await expect(
      page.getByText(/stock badges show|all branches selected|active branch/i).first(),
    ).toBeVisible({ timeout: 45_000 })
  })

  test('product wizard opening stock has no location selector', async ({ page }) => {
    await loginAsOwner(page)
    await page.goto('/products/new')
    await expect(page.getByText(/product|create|wizard|quick|variant/i).first()).toBeVisible({
      timeout: 45_000,
    })
    // Prefer variant path if entry cards shown
    const variantCard = page.getByRole('button', { name: /variant|matrix/i }).first()
    if (await variantCard.isVisible().catch(() => false)) {
      await variantCard.click()
    }
    // Navigate stepper if present
    const stockStep = page.getByText(/^stock$|pricing & stock|opening stock/i).first()
    if (await stockStep.isVisible().catch(() => false)) {
      await stockStep.click()
    }
    await expect(page.getByText(/select location/i)).toHaveCount(0)
    await expect(page.locator('label:has-text("Location")')).toHaveCount(0)
  })

  test('stock adjustment uses auto-resolved location (no location dropdown)', async ({ page }) => {
    await loginAsOwner(page)
    await page.goto('/inventory/adjustments')
    await expect(page.getByText(/stock adjustment|adjust/i).first()).toBeVisible({
      timeout: 45_000,
    })
    await expect(page.getByText(/resolved automatically|saleable location/i).first()).toBeVisible()
    await expect(page.locator('select').filter({ hasText: /select location/i })).toHaveCount(0)
  })

  test('POS and storefront shells load', async ({ page }) => {
    await loginAsOwner(page)
    await page.goto('/sales/pos')
    await expect(page.locator('body')).toBeVisible()
    await page.goto('/shop')
    await expect(page.locator('body')).toBeVisible()
  })

  test('transfer form auto-resolves locations', async ({ page }) => {
    await loginAsOwner(page)
    await page.goto('/inventory/transfers/new')
    await expect(page.locator('body')).toBeVisible()
    await expect(page.getByText(/resolved automatically|destination branch/i).first()).toBeVisible({
      timeout: 45_000,
    })
    await expect(page.getByLabel(/^from location$/i)).toHaveCount(0)
    await expect(page.getByLabel(/^to location$/i)).toHaveCount(0)
  })

  test('DB: fulfillment branch is central Head Office', async () => {
    test.skip(!canDb, 'BLOCKED: TEST_DATABASE_URL required')
    const rows = await query(`
      SELECT
        (public.get_storefront_fulfillment_context(o.id)->>'branch_id')::uuid AS fulfill_id,
        b.id AS central_id,
        b.is_central
      FROM public.organizations o
      JOIN LATERAL (
        SELECT id, is_central FROM public.branches
        WHERE organization_id = o.id AND deleted_at IS NULL AND is_active
        ORDER BY is_central DESC, created_at ASC
        LIMIT 1
      ) b ON true
      WHERE o.deleted_at IS NULL
      ORDER BY o.created_at
      LIMIT 1
    `)
    expect(rows[0]?.fulfill_id).toBe(rows[0]?.central_id)
    expect(rows[0]?.is_central).toBe(true)
  })

  test('DB: unpublished price resolves to 0 as anon', async () => {
    test.skip(!canDb, 'BLOCKED: TEST_DATABASE_URL required')
    test.skip(!env.mutatingAllowed, 'MUTATION BLOCKED for role switch test')
    requireMutatingAllowed()
    const sample = await query(`
      SELECT p.organization_id, b.id AS branch_id, p.id AS product_id, pv.id AS variant_id
      FROM products p
      JOIN product_variants pv ON pv.product_id = p.id AND pv.deleted_at IS NULL
      JOIN branches b ON b.organization_id = p.organization_id AND b.is_central AND b.deleted_at IS NULL
      WHERE p.deleted_at IS NULL AND (p.published_at IS NULL OR p.is_active = false)
      LIMIT 1
    `)
    test.skip(!sample[0], 'No unpublished product sample')
    const r = sample[0]!
    await query(`SET LOCAL ROLE anon`)
    const price = await query(
      `SELECT public.resolve_effective_price($1::uuid,$2::uuid,$3::uuid,$4::uuid) AS price`,
      [r.organization_id, r.branch_id, r.product_id, r.variant_id],
    )
    await query(`RESET ROLE`)
    expect(Number(price[0]?.price ?? -1)).toBe(0)
  })
})
