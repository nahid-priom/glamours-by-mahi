const LABELS: Record<string, string> = {
  sale_invoice: 'Sale invoice',
  sale_payment: 'Sale payment',
  sale_due: 'Sale due',
  collection: 'Collection',
  return_credit: 'Return credit',
  refund: 'Refund',
  reversal: 'Reversal',
  adjustment: 'Adjustment',
  opening: 'Opening balance',
  purchase_invoice: 'Purchase invoice',
  purchase_payment: 'Purchase payment',
  purchase_due: 'Purchase due',
  payment: 'Supplier payment',
  supplier_payment: 'Supplier payment',
}

export function partyLedgerEntryLabel(entryType: string): string {
  return LABELS[entryType] ?? entryType.replace(/_/g, ' ')
}
