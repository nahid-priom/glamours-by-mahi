import { describe, expect, it } from 'vitest'
import { buildBranchPriceIndex, resolvePriceFromIndex } from './resolve-branch-price'

describe('resolvePriceFromIndex', () => {
  it('prefers branch variant override over product and catalog prices', () => {
    const index = buildBranchPriceIndex([
      {
        product_id: 'p1',
        variant_id: null,
        retail_price: 200,
        discount_price: null,
        wholesale_price: null,
        effective_from: '2020-01-01T00:00:00Z',
        effective_to: null,
      },
      {
        product_id: 'p1',
        variant_id: 'v1',
        retail_price: 150,
        discount_price: 140,
        wholesale_price: null,
        effective_from: '2020-01-01T00:00:00Z',
        effective_to: null,
      },
    ])
    expect(
      resolvePriceFromIndex(index, {
        productId: 'p1',
        variantId: 'v1',
        variantSellingPrice: 180,
        productSellingPrice: 190,
      }),
    ).toBe(140)
  })

  it('falls back to variant selling price when no branch override', () => {
    expect(
      resolvePriceFromIndex(null, {
        productId: 'p1',
        variantId: 'v1',
        variantSellingPrice: 99,
        productSellingPrice: 120,
      }),
    ).toBe(99)
  })
})
