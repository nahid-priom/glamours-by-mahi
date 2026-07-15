import type { CartLine, CartState, CartTotals } from './types'

export function normalizeBarcode(input: string): string {
  return input.trim().replace(/[\s\-_]/g, '').toUpperCase()
}

export function calcLineTotal(line: Pick<CartLine, 'unitPrice' | 'qty' | 'lineDiscount'>): number {
  return Math.max(0, roundMoney(line.unitPrice * line.qty - line.lineDiscount))
}

export function calcCartTotals(state: CartState): CartTotals {
  const subtotal = roundMoney(state.lines.reduce((sum, line) => sum + calcLineTotal(line), 0))
  const discount = roundMoney(Math.max(0, state.invoiceDiscount))
  const tax = roundMoney(Math.max(0, state.tax))
  const shipping = roundMoney(Math.max(0, state.shipping))
  const grandTotal = roundMoney(Math.max(0, subtotal - discount + tax + shipping))
  const paid = roundMoney(state.payments.reduce((sum, p) => sum + Math.max(0, p.amount), 0))
  const due = roundMoney(Math.max(0, grandTotal - paid))
  const change = roundMoney(Math.max(0, paid - grandTotal))
  return { subtotal, tax, shipping, discount, grandTotal, paid, due, change }
}

export function canAddQty(line: Pick<CartLine, 'qty' | 'availableStock'>, addQty: number): boolean {
  if (addQty <= 0) return false
  return line.qty + addQty <= line.availableStock
}

export function mergeOrAddLine(lines: CartLine[], incoming: CartLine): CartLine[] {
  const idx = lines.findIndex((l) => l.variantId === incoming.variantId)
  if (idx === -1) {
    const qty = Math.min(incoming.qty, incoming.availableStock)
    if (qty <= 0) return lines
    return [...lines, { ...incoming, qty }]
  }
  const existing = lines[idx]
  const nextQty = Math.min(existing.qty + incoming.qty, existing.availableStock)
  if (nextQty === existing.qty) return lines
  return lines.map((l, i) => (i === idx ? { ...l, qty: nextQty, availableStock: incoming.availableStock } : l))
}

/** Throws when the cart cannot be completed / held safely. */
export function assertSaleReady(state: CartState): void {
  if (state.lines.length === 0) {
    throw new Error('Cart is empty')
  }
  for (const line of state.lines) {
    if (line.qty <= 0) throw new Error(`Invalid quantity for ${line.productName}`)
    if (line.unitPrice < 0) throw new Error(`Invalid price for ${line.productName}`)
    if (line.qty > line.availableStock) {
      throw new Error(`Insufficient stock for ${line.productName}`)
    }
  }
  const totals = calcCartTotals(state)
  const hasDuePayment = state.payments.some((p) =>
    /due|credit|receivable/i.test(p.method),
  )
  if ((totals.due > 0 || hasDuePayment) && !state.customerId) {
    throw new Error('Customer is required when balance is due')
  }
  for (const payment of state.payments) {
    if (payment.amount < 0) throw new Error('Payment amounts cannot be negative')
    if (!payment.method?.trim()) throw new Error('Payment method is required')
  }
  const methods = state.payments.map((p) => p.method.trim().toLowerCase())
  if (new Set(methods).size !== methods.length) {
    throw new Error('Duplicate payment methods are not allowed')
  }
}

function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function emptyCartState(): CartState {
  return {
    lines: [],
    customerId: null,
    customerLabel: null,
    invoiceDiscount: 0,
    tax: 0,
    shipping: 0,
    payments: [],
    note: '',
  }
}
