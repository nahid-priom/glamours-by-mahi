const LABELS: Record<string, string> = {
  sale_due: 'Sale due',
  collection: 'Collection',
  return_credit: 'Return credit',
  adjustment: 'Adjustment',
  opening: 'Opening balance',
  purchase_due: 'Purchase due',
  payment: 'Payment',
}

export function partyLedgerEntryLabel(entryType: string): string {
  return LABELS[entryType] ?? entryType.replace(/_/g, ' ')
}
