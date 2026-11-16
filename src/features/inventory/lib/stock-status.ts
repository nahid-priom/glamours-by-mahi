export type StockStatusKey =
  | 'in_stock'
  | 'low_stock'
  | 'out_of_stock'
  | 'negative_stock'
  | 'in_transit'
  | 'damaged'
  | 'quarantine'

/** Matches SQL `_inventory_stock_status` (available is not clamped before status). */
export function resolveAvailableStockStatus(
  available: number,
  reorderLevel: number,
): StockStatusKey {
  if (available < 0) return 'negative_stock'
  if (available <= 0) return 'out_of_stock'
  if (reorderLevel > 0 && available <= reorderLevel) return 'low_stock'
  return 'in_stock'
}

export function resolveLocationStockStatus(
  locationType: string,
  quantity: number,
): StockStatusKey | null {
  const type = locationType.toLowerCase()
  if (type === 'damaged' && quantity > 0) return 'damaged'
  if (type === 'quarantine' && quantity > 0) return 'quarantine'
  if (type === 'in_transit' && quantity > 0) return 'in_transit'
  return null
}

export function matchesStockStatusFilter(
  filter: string,
  available: number,
  reorderLevel: number,
  locationType?: string,
): boolean {
  if (!filter || filter === 'all') return true
  const status = locationType
    ? resolveLocationStockStatus(locationType, available) ??
      resolveAvailableStockStatus(available, reorderLevel)
    : resolveAvailableStockStatus(available, reorderLevel)
  return status === filter
}
