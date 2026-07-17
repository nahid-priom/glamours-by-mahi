import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/auth-session'
import { queryKeys } from '@/lib/query/keys'
import {
  defaultSalesFilters,
  filtersFromSearchParams,
  filtersToSearchParams,
} from '../schemas/sale-filters.schema'
import {
  exportSalesHistory,
  getSalesHistoryKpis,
  listSalesHistory,
} from '../repositories/sales.repository'
import type { SalesHistoryFilters } from '../types/sale.types'

export function useSalesHistoryFilters() {
  const { activeBranchId } = useAuth()
  const [params, setParams] = useSearchParams()

  const filters = useMemo(
    () => filtersFromSearchParams(params, activeBranchId),
    [params, activeBranchId],
  )

  const setFilters = (next: SalesHistoryFilters | ((prev: SalesHistoryFilters) => SalesHistoryFilters)) => {
    const resolved = typeof next === 'function' ? next(filters) : next
    setParams(filtersToSearchParams(resolved), { replace: true })
  }

  const clearFilters = () => {
    setParams(filtersToSearchParams(defaultSalesFilters(activeBranchId)), { replace: true })
  }

  return { filters, setFilters, clearFilters }
}

export function useSalesHistoryQuery(filters: SalesHistoryFilters) {
  return useQuery({
    queryKey: queryKeys.sales(filters as unknown as Record<string, unknown>),
    queryFn: () => listSalesHistory(filters),
    placeholderData: (prev) => prev,
  })
}

export function useSalesKpisQuery(filters: SalesHistoryFilters) {
  const kpiFilters = useMemo(
    () => ({ ...filters, page: 1, pageSize: filters.pageSize }),
    [filters],
  )
  return useQuery({
    queryKey: queryKeys.salesKpis(kpiFilters as unknown as Record<string, unknown>),
    queryFn: () => getSalesHistoryKpis(kpiFilters),
  })
}

export function useInvalidateSalesQueries() {
  const qc = useQueryClient()
  return (saleId?: string) => {
    void qc.invalidateQueries({ queryKey: ['sales'] })
    void qc.invalidateQueries({ queryKey: ['sales-kpis'] })
    if (saleId) void qc.invalidateQueries({ queryKey: queryKeys.sale(saleId) })
    void qc.invalidateQueries({ queryKey: ['inventory'] })
    void qc.invalidateQueries({ queryKey: ['stock-overview'] })
    void qc.invalidateQueries({ queryKey: ['customers'] })
    void qc.invalidateQueries({ queryKey: ['accounts'] })
  }
}

export async function downloadSalesCsv(filters: SalesHistoryFilters) {
  const result = await exportSalesHistory(filters)
  const header = [
    'Invoice',
    'Date',
    'Customer',
    'Phone',
    'Branch',
    'Cashier',
    'Items',
    'Categories',
    'Subtotal',
    'Discount',
    'Total',
    'Paid',
    'Due',
    'Payment Methods',
    'Sale Status',
    'Payment Status',
  ]
  const rows = result.items.map((r) =>
    [
      r.invoice_no,
      r.sale_at,
      r.customer_name ?? 'Walk-in',
      r.customer_phone ?? '',
      r.branch_name ?? '',
      r.cashier_name ?? '',
      r.item_qty,
      (r.category_summary ?? []).map((c) => `${c.name}x${c.qty}`).join('; '),
      r.subtotal,
      r.discount,
      r.grand_total,
      r.paid_total,
      r.due_total,
      r.payment_methods ?? '',
      r.status,
      r.payment_status,
    ]
      .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
      .join(','),
  )
  const blob = new Blob([[header.join(','), ...rows].join('\n')], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `sales-export-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
