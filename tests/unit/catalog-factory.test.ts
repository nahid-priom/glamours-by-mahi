import { describe, expect, it } from 'vitest'
import { sixVariantMatrix, SUPPLIER_FIFO_SCENARIO, productFixtureNames } from '../factories/catalog'

describe('catalog factories', () => {
  it('builds exactly six shade×size variant combinations', () => {
    const combos = sixVariantMatrix()
    expect(combos).toHaveLength(6)
    const keys = new Set(combos.map((c) => `${c.shade}|${c.size}`))
    expect(keys.size).toBe(6)
  })

  it('documents FIFO provenance expectations without conflating WAC', () => {
    expect(
      SUPPLIER_FIFO_SCENARIO.supplierAReceive + SUPPLIER_FIFO_SCENARIO.supplierBReceive,
    ).toBe(80)
    expect(SUPPLIER_FIFO_SCENARIO.expectedTotalRemaining).toBe(60)
    expect(
      SUPPLIER_FIFO_SCENARIO.expectedRemainingA + SUPPLIER_FIFO_SCENARIO.expectedRemainingB,
    ).toBe(SUPPLIER_FIFO_SCENARIO.expectedTotalRemaining)
  })

  it('scopes fixture names to TEST_RUN_ID', () => {
    const names = productFixtureNames('qa-run-abc12345')
    expect(names.VARIANT_PRODUCT).toContain('abc12345')
    expect(names.SUPPLIER_A).toMatch(/^QA Supplier A/)
  })
})
