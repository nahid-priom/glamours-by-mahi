import type { QueryClient } from '@tanstack/react-query'
import { invalidateDashboardCaches } from '@/lib/mutations/dashboard-cache'

export function invalidateInventoryQueries(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: ['inventory-valuation-summary'] })
  void qc.invalidateQueries({ queryKey: ['inventory-branch-summary'] })
  void qc.invalidateQueries({ queryKey: ['inventory-stock-breakdown'] })
  void qc.invalidateQueries({ queryKey: ['low-stock'] })
  void qc.invalidateQueries({ queryKey: ['inventory-balances'] })
  void qc.invalidateQueries({ queryKey: ['stock-overview'] })
  void qc.invalidateQueries({ queryKey: ['stock-ledger'] })
  void invalidateDashboardCaches(qc)
}
