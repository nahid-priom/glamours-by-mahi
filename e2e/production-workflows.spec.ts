import { test } from '@playwright/test'

/**
 * Legacy placeholder file — real workflows live in e2e/critical-flows/e2e-01-to-24.spec.ts.
 * Kept so older docs/CI references do not invent silent PASS skips.
 */
test.describe('production workflows (relocated)', () => {
  test('see e2e/critical-flows for E2E-01..24', async () => {
    test.skip(true, 'Relocated to e2e/critical-flows/e2e-01-to-24.spec.ts')
  })
})
