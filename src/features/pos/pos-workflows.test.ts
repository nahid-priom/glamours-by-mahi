import { describe, expect, it } from 'vitest'
import {
  assertSaleReady,
  calcCartTotals,
  canAddQty,
  mergeOrAddLine,
  normalizeBarcode,
  emptyCartState,
} from './cart-utils'
import type { CartLine } from './types'

const line = (over: Partial<CartLine> = {}): CartLine => ({
  variantId: 'v1',
  productId: 'p1',
  productName: 'Shirt',
  variantLabel: 'M / Black',
  sku: 'SKU-1',
  barcode: '1234567890123',
  unitPrice: 1000,
  qty: 1,
  lineDiscount: 0,
  availableStock: 5,
  ...over,
})

describe('POS critical workflows', () => {
  it('exact barcode normalize trims and strips separators', () => {
    expect(normalizeBarcode('  ABC-99  ')).toBe('ABC99')
  })

  it('duplicate scan increases qty via merge', () => {
    const merged = mergeOrAddLine([line({ qty: 1 })], line({ qty: 1 }))
    expect(merged[0].qty).toBe(2)
  })

  it('blocks qty over stock', () => {
    expect(canAddQty(line({ qty: 5, availableStock: 5 }), 1)).toBe(false)
  })

  it('due payment without customer fails readiness', () => {
    const state = {
      ...emptyCartState(),
      lines: [line()],
      payments: [{ method: 'Customer Due', amount: 1000 }],
    }
    expect(() => assertSaleReady(state)).toThrow(/Customer is required/)
  })

  it('split payments ok when equal grand total with customer', () => {
    const state = {
      ...emptyCartState(),
      customerId: 'c1',
      customerLabel: 'Nadia',
      lines: [line({ unitPrice: 10000, qty: 1 })],
      payments: [
        { method: 'Cash', amount: 3000, financialAccountId: 'fa1' },
        { method: 'bKash', amount: 2000, financialAccountId: 'fa2' },
        { method: 'Card', amount: 3000, financialAccountId: 'fa3' },
        { method: 'Customer Due', amount: 2000 },
      ],
    }
    expect(() => assertSaleReady(state)).not.toThrow()
    expect(calcCartTotals(state).grandTotal).toBe(10000)
  })
})
