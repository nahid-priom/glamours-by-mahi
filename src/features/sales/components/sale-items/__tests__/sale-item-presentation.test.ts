import { describe, expect, it } from 'vitest'
import {
  formatProductCount,
  formatSaleItemMoney,
  formatSaleItemQty,
  getSaleItemMetadata,
  getSaleItemProductName,
  toSaleItemViewModel,
} from '../sale-item-presentation'
import type { SaleDetailLineItem } from '../sale-item.types'

function makeItem(
  overrides: Partial<SaleDetailLineItem> & {
    line_origin?: string | null
    product_variants?: SaleDetailLineItem['product_variants']
  } = {},
): SaleDetailLineItem {
  const { line_origin, product_variants, ...rest } = overrides
  return {
    id: 'item-1',
    sale_id: 'sale-1',
    variant_id: 'variant-1',
    batch_id: null,
    qty: 2,
    unit_price: 1500,
    line_total: 3000,
    line_discount: 0,
    cost_price: 0,
    organization_id: 'org-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    created_by: null,
    updated_by: null,
    deleted_at: null,
    product_variants: product_variants ?? {
      sku: 'SKU-001',
      name: 'Rose',
      products: {
        id: 'prod-1',
        name: 'Urban Rose Crossbody Bag',
        image_url: null,
      },
    },
    ...rest,
    ...(line_origin !== undefined ? { line_origin } : {}),
  } as SaleDetailLineItem
}

describe('sale-item-presentation', () => {
  it('reads product name and falls back to Item', () => {
    expect(getSaleItemProductName(makeItem())).toBe('Urban Rose Crossbody Bag')
    expect(
      getSaleItemProductName(
        makeItem({ product_variants: { sku: 'X', name: null, products: null } }),
      ),
    ).toBe('Item')
  })

  it('builds metadata from sku, variant, and line_origin', () => {
    expect(getSaleItemMetadata(makeItem({ line_origin: 'pos' }))).toBe(
      'SKU-001 · Rose · pos',
    )
    expect(
      getSaleItemMetadata(
        makeItem({
          product_variants: { sku: '', name: null, products: null },
        }),
      ),
    ).toBe('')
  })

  it('maps view model without altering money values', () => {
    const vm = toSaleItemViewModel(makeItem({ qty: 1.25, unit_price: 99.5, line_total: 124.375 }))
    expect(vm.qty).toBe(1.25)
    expect(vm.unitPrice).toBe(99.5)
    expect(vm.lineTotal).toBe(124.375)
    expect(vm.productName).toBe('Urban Rose Crossbody Bag')
    expect(vm.metadata).toBe('SKU-001 · Rose')
  })

  it('formats qty and money with existing helpers', () => {
    expect(formatSaleItemQty(0.5)).toBe('0.5')
    expect(formatSaleItemMoney(1500)).toContain('1,500')
    expect(formatProductCount(1)).toBe('1 Product')
    expect(formatProductCount(3)).toBe('3 Products')
  })

  it('preserves long product names', () => {
    const long =
      'অত্যন্ত লম্বা প্রোডাক্ট নাম Urban Rose Crossbody Bag Premium Edition With Extra Details'
    const vm = toSaleItemViewModel(
      makeItem({
        product_variants: {
          sku: 'LONG-SKU-123456789',
          name: 'XL',
          products: { id: 'p', name: long, image_url: null },
        },
      }),
    )
    expect(vm.productName).toBe(long)
    expect(vm.metadata).toContain('LONG-SKU-123456789')
  })
})
