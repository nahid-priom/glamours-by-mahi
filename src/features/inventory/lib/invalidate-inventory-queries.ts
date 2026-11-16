import type { QueryClient } from '@tanstack/react-query'
import { invalidateDashboardCaches } from '@/lib/mutations/dashboard-cache'

export function invalidateInventoryQueries(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: ['inventory-valuation-summary'] })
  void qc.invalidateQueries({ queryKey: ['inventory-branch-summary'] })
  void qc.invalidateQueries({ queryKey: ['inventory-stock-breakdown'] })
  void qc.invalidateQueries({ queryKey: ['inventory-variant-breakdown'] })
  void qc.invalidateQueries({ queryKey: ['inventory-low-stock'] })
  void qc.invalidateQueries({ queryKey: ['inventory-supplier-kpis'] })
  void qc.invalidateQueries({ queryKey: ['inventory-supplier-summary'] })
  void qc.invalidateQueries({ queryKey: ['inventory-supplier-breakdown'] })
  void qc.invalidateQueries({ queryKey: ['inventory-supplier-movements'] })
  void qc.invalidateQueries({ queryKey: ['low-stock'] })
  void qc.invalidateQueries({ queryKey: ['inventory-balances'] })
  void qc.invalidateQueries({ queryKey: ['inventory'] })
  void qc.invalidateQueries({ queryKey: ['stock-overview'] })
  void qc.invalidateQueries({ queryKey: ['stock-ledger'] })
  void qc.invalidateQueries({ queryKey: ['stock-transfers'] })
  void qc.invalidateQueries({ queryKey: ['products'] })
  void qc.invalidateQueries({ queryKey: ['product-catalog-kpis'] })
  void qc.invalidateQueries({ queryKey: ['pos-products'] })
  void invalidateDashboardCaches(qc)
}
