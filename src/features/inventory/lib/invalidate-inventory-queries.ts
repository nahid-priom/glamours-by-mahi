import type { QueryClient } from '@tanstack/react-query'

export function invalidateInventoryQueries(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: ['inventory-valuation-summary'] })
  void qc.invalidateQueries({ queryKey: ['inventory-branch-summary'] })
  void qc.invalidateQueries({ queryKey: ['inventory-stock-breakdown'] })
  void qc.invalidateQueries({ queryKey: ['low-stock'] })
  void qc.invalidateQueries({ queryKey: ['inventory-balances'] })
  void qc.invalidateQueries({ queryKey: ['stock-overview'] })
}
