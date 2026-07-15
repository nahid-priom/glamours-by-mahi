import { useCallback, useState } from 'react'
import {
  assertSaleReady,
  calcCartTotals,
  canAddQty,
  emptyCartState,
  mergeOrAddLine,
} from './cart-utils'
import type { CartLine, CartPayment, CartState, HeldSalePayload, PosVariant } from './types'

export function usePosCart(initial?: Partial<CartState>) {
  const [state, setState] = useState<CartState>(() => ({
    ...emptyCartState(),
    ...initial,
    lines: initial?.lines ?? [],
    payments: initial?.payments ?? [],
  }))

  const totals = calcCartTotals(state)

  const addVariant = useCallback((variant: PosVariant, qty = 1) => {
    const incoming: CartLine = {
      variantId: variant.variantId,
      productId: variant.productId,
      productName: variant.productName,
      variantLabel: variant.variantLabel,
      sku: variant.sku,
      barcode: variant.barcode ?? '',
      thumbnailUrl: variant.thumbnailUrl ?? undefined,
      unitPrice: variant.unitPrice,
      qty,
      lineDiscount: 0,
      availableStock: variant.availableStock,
    }
    setState((prev) => {
      const existing = prev.lines.find((l) => l.variantId === variant.variantId)
      if (existing && !canAddQty(existing, qty)) return prev
      if (!existing && variant.availableStock < qty) return prev
      return { ...prev, lines: mergeOrAddLine(prev.lines, incoming) }
    })
  }, [])

  const setLineQty = useCallback((variantId: string, qty: number) => {
    setState((prev) => ({
      ...prev,
      lines: prev.lines
        .map((l) => {
          if (l.variantId !== variantId) return l
          const next = Math.max(0, Math.min(qty, l.availableStock))
          return { ...l, qty: next }
        })
        .filter((l) => l.qty > 0),
    }))
  }, [])

  const adjustLineQty = useCallback((variantId: string, delta: number) => {
    setState((prev) => ({
      ...prev,
      lines: prev.lines
        .map((l) => {
          if (l.variantId !== variantId) return l
          const next = Math.max(0, Math.min(l.qty + delta, l.availableStock))
          return { ...l, qty: next }
        })
        .filter((l) => l.qty > 0),
    }))
  }, [])

  const setLineDiscount = useCallback((variantId: string, lineDiscount: number) => {
    setState((prev) => ({
      ...prev,
      lines: prev.lines.map((l) =>
        l.variantId === variantId
          ? { ...l, lineDiscount: Math.max(0, lineDiscount) }
          : l,
      ),
    }))
  }, [])

  const removeLine = useCallback((variantId: string) => {
    setState((prev) => ({
      ...prev,
      lines: prev.lines.filter((l) => l.variantId !== variantId),
    }))
  }, [])

  const setCustomer = useCallback((customerId: string | null, customerLabel: string | null = null) => {
    setState((prev) => ({ ...prev, customerId, customerLabel }))
  }, [])

  const setInvoiceDiscount = useCallback((invoiceDiscount: number) => {
    setState((prev) => ({ ...prev, invoiceDiscount: Math.max(0, invoiceDiscount) }))
  }, [])

  const setTax = useCallback((tax: number) => {
    setState((prev) => ({ ...prev, tax: Math.max(0, tax) }))
  }, [])

  const setShipping = useCallback((shipping: number) => {
    setState((prev) => ({ ...prev, shipping: Math.max(0, shipping) }))
  }, [])

  const setPayments = useCallback((payments: CartPayment[]) => {
    setState((prev) => ({ ...prev, payments }))
  }, [])

  const setNote = useCallback((note: string) => {
    setState((prev) => ({ ...prev, note }))
  }, [])

  const reset = useCallback(() => {
    setState(emptyCartState())
  }, [])

  const restore = useCallback((next: CartState) => {
    setState(next)
  }, [])

  const serializeHold = useCallback(
    (branchId: string, holdLabel?: string | null): HeldSalePayload => {
      if (state.lines.length === 0) throw new Error('Cart is empty')
      return {
        holdLabel: holdLabel ?? null,
        branchId,
        customerId: state.customerId,
        customerLabel: state.customerLabel,
        note: state.note,
        invoiceDiscount: state.invoiceDiscount,
        tax: state.tax,
        shipping: state.shipping,
        lines: state.lines,
        payments: state.payments,
      }
    },
    [state],
  )

  return {
    state,
    totals,
    addVariant,
    setLineQty,
    adjustLineQty,
    setLineDiscount,
    removeLine,
    setCustomer,
    setInvoiceDiscount,
    setTax,
    setShipping,
    setPayments,
    setNote,
    reset,
    restore,
    serializeHold,
    assertReady: () => assertSaleReady(state),
  }
}
