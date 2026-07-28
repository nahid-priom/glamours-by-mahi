import { describe, expect, it } from 'vitest'
import { buildBranchPricesPayload } from './branch-price-payload'
import type { VariantDraft } from './variant-matrix'

const variants: VariantDraft[] = [
  {
    key: 'Blue::M',
    label: 'Blue / M',
    size: 'M',
    color: 'Blue',
    sku: 'SKU-1',
    barcode: '',
    purchase_price: 500,
    selling_price: 1200,
    wholesale_price: 1000,
    opening_stock: 0,
    is_active: true,
  },
  {
    key: 'Navy::M',
    label: 'Navy / M',
    size: 'M',
    color: 'Navy',
    sku: 'SKU-2',
    barcode: '',
    purchase_price: 500,
    selling_price: 1200,
    wholesale_price: null,
    opening_stock: 0,
    is_active: true,
  },
]

describe('buildBranchPricesPayload', () => {
  it('returns empty when branch is not selected', () => {
    expect(
      buildBranchPricesPayload({
        branchId: '',
        isMatrix: false,
        retailPrice: 1200,
        wholesalePrice: 1000,
        openingQuantity: 5,
      }),
    ).toEqual([])
  })

  it('returns empty for simple product with zero opening quantity', () => {
    expect(
      buildBranchPricesPayload({
        branchId: 'branch-1',
        isMatrix: false,
        retailPrice: 1200,
        wholesalePrice: 1000,
        openingQuantity: 0,
      }),
    ).toEqual([])
  })

  it('builds product-level branch price for simple product with stock', () => {
    expect(
      buildBranchPricesPayload({
        branchId: 'branch-1',
        isMatrix: false,
        retailPrice: 1200,
        wholesalePrice: 1000,
        openingQuantity: 10,
      }),
    ).toEqual([
      {
        branch_id: 'branch-1',
        retail_price: 1200,
        wholesale_price: 1000,
      },
    ])
  })

  it('builds per-variant branch prices only for variants with stock', () => {
    expect(
      buildBranchPricesPayload({
        branchId: 'branch-1',
        isMatrix: true,
        variantDrafts: variants,
        variantStock: { 'Blue::M': 5, 'Navy::M': 0 },
        retailPrice: 1200,
        wholesalePrice: 1000,
      }),
    ).toEqual([
      {
        branch_id: 'branch-1',
        variant_key: 'Blue::M',
        retail_price: 1200,
        wholesale_price: 1000,
      },
    ])
  })
})
