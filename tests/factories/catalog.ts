/**
 * Deterministic catalog fixture definitions for staging seeds.
 * Factories describe intended data; seeding is performed by e2e/setup
 * against a verified non-production environment only.
 */

export const VARIANT_SHADES = ['Ruby Red', 'Rose Pink', 'Nude Brown'] as const
export const VARIANT_SIZES = ['3.5g', '5g'] as const

/** Six unique shade×size combinations */
export function sixVariantMatrix() {
  const combos: { shade: string; size: string; skuSuffix: string }[] = []
  for (const shade of VARIANT_SHADES) {
    for (const size of VARIANT_SIZES) {
      combos.push({
        shade,
        size,
        skuSuffix: `${shade.slice(0, 3).toUpperCase()}-${size.replace('.', '')}`,
      })
    }
  }
  if (combos.length !== 6) {
    throw new Error(`Expected 6 variant combos, got ${combos.length}`)
  }
  return combos
}

export function productFixtureNames(runId: string) {
  const tag = runId.slice(-8)
  return {
    SIMPLE_PRODUCT: `QA Simple ${tag}`,
    VARIANT_PRODUCT: `QA Variant Matrix ${tag}`,
    ZERO_STOCK_PRODUCT: `QA Zero Stock ${tag}`,
    LOW_STOCK_PRODUCT: `QA Low Stock ${tag}`,
    ARCHIVED_PRODUCT: `QA Archived ${tag}`,
    SUPPLIER_A: `QA Supplier A ${tag}`,
    SUPPLIER_B: `QA Supplier B ${tag}`,
    CUSTOMER_A: `QA Customer A ${tag}`,
    CUSTOMER_B: `QA Customer B ${tag}`,
    BRANCH_A: `QA Branch A ${tag}`,
    BRANCH_B: `QA Branch B ${tag}`,
  }
}

export const SUPPLIER_FIFO_SCENARIO = {
  supplierAReceive: 50,
  supplierBReceive: 30,
  sellQty: 20,
  /** Under FIFO provenance attribution after selling 20 from A first */
  expectedRemainingA: 30,
  expectedRemainingB: 30,
  expectedTotalRemaining: 60,
} as const
