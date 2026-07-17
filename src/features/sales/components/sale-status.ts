import type { SalesHistoryRow } from '../types/sale.types'

export type PaymentBadge = {
  label: string
  variant: 'success' | 'warning' | 'danger' | 'info' | 'default'
}

/** Single user-friendly payment badge for a sale row. */
export function paymentBadge(row: SalesHistoryRow): PaymentBadge {
  if (row.status === 'voided') return { label: 'Voided', variant: 'default' }
  if (row.payment_status === 'refunded') return { label: 'Returned', variant: 'info' }
  if (row.payment_status === 'paid' || row.payment_status === 'overpaid') {
    return { label: 'Paid', variant: 'success' }
  }
  if (row.payment_status === 'partial') return { label: 'Partial', variant: 'warning' }
  return { label: 'Due', variant: 'danger' }
}

/** Secondary lifecycle note only when the sale genuinely needs attention. */
export function lifecycleNote(row: SalesHistoryRow): string | null {
  if (row.status === 'corrected') return 'Corrected'
  if (row.status === 'draft') return 'Draft'
  return null
}
