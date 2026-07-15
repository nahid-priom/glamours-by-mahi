import { describe, expect, it } from 'vitest'
import {
  assertSaleReady,
  calcCartTotals,
  calcLineTotal,
  canAddQty,
  emptyCartState,
  mergeOrAddLine,
  normalizeBarcode,
} from './cart-utils'
import type { CartLine, CartState } from './types'

function line(partial: Partial<CartLine> = {}): CartLine {
  return {
    variantId: 'v0',
    productId: 'p1',
    productName: 'Tee',
    variantLabel: 'M',
    sku: 'SKU-1',
    barcode: '123',
    unitPrice: 100,
    qty: 1,
    lineDiscount: 0,
    availableStock: 5,
    ...partial,
  }
}

describe('normalizeBarcode', () => {
  it('trims, strips separators, and uppercases', () => {
    expect(normalizeBarcode('  abc-12_3 ')).toBe('ABC123')
    expect(normalizeBarcode('890\t123')).toBe('890123')
  })
})

describe('calcLineTotal / calcCartTotals', () => {
  it('computes line and cart totals', () => {
    expect(calcLineTotal(line({ qty: 2, unitPrice: 50, lineDiscount: 10 }))).toBe(90)
    const state: CartState = {
      ...emptyCartState(),
      lines: [line({ qty: 2, unitPrice: 100, lineDiscount: 20 })],
      invoiceDiscount: 10,
      tax: 5,
      shipping: 15,
      payments: [{ method: 'cash', amount: 150 }],
    }
    const t = calcCartTotals(state)
    expect(t.subtotal).toBe(180)
    expect(t.discount).toBe(10)
    expect(t.grandTotal).toBe(190)
    expect(t.paid).toBe(150)
    expect(t.due).toBe(40)
    expect(t.change).toBe(0)
  })
})

describe('stock helpers', () => {
  it('blocks qty above available stock', () => {
    const l = line({ qty: 4, availableStock: 5 })
    expect(canAddQty(l, 1)).toBe(true)
    expect(canAddQty(l, 2)).toBe(false)
  })

  it('mergeOrAddLine respects stock cap and out-of-stock', () => {
    const base = [line({ variantId: 'v1', qty: 2, availableStock: 3 })]
    const merged = mergeOrAddLine(base, line({ variantId: 'v1', qty: 5, availableStock: 3 }))
    expect(merged[0].qty).toBe(3)

    const empty = mergeOrAddLine([], line({ variantId: 'v2', qty: 1, availableStock: 0 }))
    expect(empty).toEqual([])
  })
})

describe('assertSaleReady', () => {
  it('throws when due > 0 without customer', () => {
    const state: CartState = {
      ...emptyCartState(),
      lines: [line({ variantId: 'v1', qty: 1, unitPrice: 100 })],
      payments: [{ method: 'cash', amount: 40 }],
      customerId: null,
    }
    expect(() => assertSaleReady(state)).toThrow(/customer/i)
  })

  it('allows due when customer present', () => {
    const state: CartState = {
      ...emptyCartState(),
      lines: [line({ variantId: 'v1', qty: 1, unitPrice: 100 })],
      payments: [{ method: 'cash', amount: 40 }],
      customerId: 'c1',
    }
    expect(() => assertSaleReady(state)).not.toThrow()
  })

  it('throws on duplicate payment methods', () => {
    const state: CartState = {
      ...emptyCartState(),
      lines: [line({ variantId: 'v1' })],
      customerId: 'c1',
      payments: [
        { method: 'cash', amount: 50 },
        { method: 'Cash', amount: 50 },
      ],
    }
    expect(() => assertSaleReady(state)).toThrow(/duplicate/i)
  })

  it('throws when line exceeds stock', () => {
    const state: CartState = {
      ...emptyCartState(),
      lines: [line({ variantId: 'v1', qty: 9, availableStock: 2 })],
      customerId: 'c1',
      payments: [{ method: 'cash', amount: 900 }],
    }
    expect(() => assertSaleReady(state)).toThrow(/stock/i)
  })
})
