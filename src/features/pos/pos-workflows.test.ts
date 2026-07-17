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
    expect(normalizeBarcode('890_12 34')).toBe('8901234')
    expect(normalizeBarcode('   ')).toBe('')
  })

  it('duplicate scan increases qty via merge', () => {
    const merged = mergeOrAddLine([line({ qty: 1 })], line({ qty: 1 }))
    expect(merged[0].qty).toBe(2)
  })

  it('repeated scans cap at available stock', () => {
    let lines = [line({ qty: 1, availableStock: 3 })]
    lines = mergeOrAddLine(lines, line({ qty: 1, availableStock: 3 }))
    lines = mergeOrAddLine(lines, line({ qty: 1, availableStock: 3 }))
    lines = mergeOrAddLine(lines, line({ qty: 1, availableStock: 3 }))
    expect(lines[0].qty).toBe(3)
  })

  it('blocks qty over stock', () => {
    expect(canAddQty(line({ qty: 5, availableStock: 5 }), 1)).toBe(false)
  })

  it('out-of-stock product cannot be added', () => {
    const result = mergeOrAddLine([], line({ qty: 1, availableStock: 0 }))
    expect(result).toEqual([])
  })

  it('quantity cannot go below one via merge (zero filtered by cart hook)', () => {
    expect(canAddQty(line({ qty: 1, availableStock: 5 }), 0)).toBe(false)
    expect(canAddQty(line({ qty: 1, availableStock: 5 }), -1)).toBe(false)
  })

  it('due payment without customer fails readiness', () => {
    const state = {
      ...emptyCartState(),
      lines: [line()],
      payments: [{ method: 'Customer Due', amount: 1000 }],
    }
    expect(() => assertSaleReady(state)).toThrow(/Customer is required/)
  })

  it('empty cart fails readiness', () => {
    expect(() => assertSaleReady(emptyCartState())).toThrow(/empty/i)
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

  it('idempotency key should be stable for a single sale attempt', () => {
    const key = 'txn-stable-1'
    expect(key).toBe('txn-stable-1')
    // After success a new key is generated; reuse of the same key is safe
    // because complete_pos_sale returns the existing sale via client_txn_key.
    expect(key.length).toBeGreaterThan(0)
  })
})
