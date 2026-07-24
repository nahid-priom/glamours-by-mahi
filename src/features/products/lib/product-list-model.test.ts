import { describe, expect, it } from 'vitest'
import {
  UNCATEGORIZED_CATEGORY_ID,
  buildProductInventoryViewModels,
  formatProductPriceLabel,
  groupProductsByCategory,
  normalizeProductInventoryItem,
} from './product-list-model'
import type { ProductListItem } from '../repositories/catalog.repository'

function makeProduct(overrides: Partial<ProductListItem> = {}): ProductListItem {
  return {
    id: overrides.id ?? 'p1',
    name: overrides.name ?? 'Test Product',
    base_sku: overrides.base_sku ?? 'SKU-1',
    selling_price: overrides.selling_price ?? 1590,
    purchase_price: overrides.purchase_price ?? 0,
    unit: overrides.unit ?? 'pcs',
    is_active: overrides.is_active ?? true,
    status: overrides.status ?? 'active',
    created_at: overrides.created_at ?? '2026-01-01T00:00:00.000Z',
    categories: overrides.categories ?? { id: 'c1', name: 'Footwear' },
    brands: overrides.brands ?? { id: 'b1', name: 'Mahi Essentials' },
    product_variants: overrides.product_variants ?? [],
    variantCount: overrides.variantCount ?? 1,
    totalStock: overrides.totalStock ?? 100,
    coverUrl: overrides.coverUrl ?? null,
    ...overrides,
  } as ProductListItem
}

describe('product-list-model', () => {
  it('formats single and ranged prices', () => {
    const single = makeProduct({ selling_price: 1590 })
    expect(formatProductPriceLabel(single)).toBe('৳1,590')

    const ranged = makeProduct({
      product_variants: [
        { id: 'v1', selling_price: 1590, deleted_at: null },
        { id: 'v2', selling_price: 2490, deleted_at: null },
      ],
      variantCount: 2,
    })
    expect(formatProductPriceLabel(ranged)).toBe('৳1,590–৳2,490')
  })

  it('uses available stock from valuation breakdown', () => {
    const product = makeProduct({ totalStock: 2600 })
    const view = normalizeProductInventoryItem(product, {
      product_id: product.id,
      product_name: product.name,
      product_code: null,
      product_type: 'goods',
      category: 'Footwear',
      brand: 'Mahi Essentials',
      variant_count: 1,
      total_quantity: 2600,
      reserved_quantity: 80,
      available_quantity: 2520,
      average_unit_cost: 10,
      total_purchase_cost: 26000,
      effective_selling_price: 1590,
      total_stock_value: 25200,
      potential_profit: null,
      reorder_level: 10,
      stock_status: 'in_stock',
      branch_count: 1,
      last_stock_movement_at: null,
    })

    expect(view.availableStock).toBe(2520)
    expect(view.onHand).toBe(2600)
    expect(view.reserved).toBe(80)
  })

  it('groups products by category id and handles uncategorized', () => {
    const products = [
      normalizeProductInventoryItem(makeProduct({ id: 'p1', categories: { id: 'c1', name: 'Footwear' } }), undefined),
      normalizeProductInventoryItem(
        makeProduct({ id: 'p2', categories: { id: 'c2', name: "Women's Wear" } }),
        undefined,
      ),
      normalizeProductInventoryItem(makeProduct({ id: 'p3', categories: null }), undefined),
    ]

    const groups = groupProductsByCategory(products)
    expect(groups).toHaveLength(3)
    expect(groups.find((g) => g.categoryId === UNCATEGORIZED_CATEGORY_ID)?.productCount).toBe(1)
    expect(groups.find((g) => g.categoryId === 'c1')?.categoryName).toBe('Footwear')
  })

  it('sorts by stock descending within the current page', () => {
    const { items } = buildProductInventoryViewModels(
      [
        makeProduct({ id: 'low', totalStock: 5 }),
        makeProduct({ id: 'high', totalStock: 500 }),
      ],
      new Map(),
      'stock_desc',
    )

    expect(items[0]?.id).toBe('high')
    expect(items[1]?.id).toBe('low')
  })
})
