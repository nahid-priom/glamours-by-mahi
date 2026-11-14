/**
 * Scoped enterprise-readable typography tokens for transaction line items.
 * Do not apply these to the shared Table defaults — pass via local className.
 */
export const enterpriseReadable = {
  sectionTitle: 'text-xl font-semibold text-text-primary',
  sectionMeta: 'text-sm font-medium text-text-muted',
  tableHeader: 'text-sm font-semibold text-text-muted',
  productName: 'text-base font-semibold leading-6 text-text-primary',
  metadata: 'text-sm leading-5 text-text-muted',
  quantity: 'text-base font-medium tabular-nums text-text-primary',
  unitPrice: 'text-base font-medium tabular-nums text-text-primary',
  lineTotal: 'text-[17px] font-semibold tabular-nums text-text-primary',
  grandTotal: 'text-xl font-bold tabular-nums text-text-primary',
  lineTotalLabel: 'text-sm font-medium text-text-muted',
} as const
