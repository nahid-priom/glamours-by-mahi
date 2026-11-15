import { useCallback, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-session'
import { downloadCsv } from '@/lib/format'
import { queryKeys } from '@/lib/query/keys'
import { BranchStockTable } from '../components/BranchStockTable'
import { InventoryEmptyState } from '../components/InventoryEmptyState'
import { InventoryFilterBar } from '../components/InventoryFilterBar'
import { InventoryKpiGrid } from '../components/InventoryKpiGrid'
import { InventoryPageHeader } from '../components/InventoryPageHeader'
import { InventoryTableSkeleton } from '../components/InventoryTableSkeleton'
import { InventoryViewSwitcher } from '../components/InventoryViewSwitcher'
import { LowStockTable } from '../components/LowStockTable'
import { ProductStockTable } from '../components/ProductStockTable'
import { StockDetailsDrawer } from '../components/StockDetailsDrawer'
import { VariantStockTable } from '../components/VariantStockTable'
import {
  clearInventoryFilters,
  filtersFromSearchParams,
  filtersToSearchParams,
  toValuationFilters,
  type InventoryPageFilters,
  type InventoryView,
} from '../lib/inventory-filters'
import { matchesStockStatusFilter } from '../lib/stock-status'
import { branchStock, lowStock } from '../repositories/inventory.repository'
import {
  getInventoryBranchSummary,
  getInventoryStockBreakdown,
  getInventoryValuationSummary,
  listAccessibleBranches,
  type InventoryProductStockRow,
} from '../repositories/inventory-valuation.repository'

const PAGE_SIZE = 20

export function StockOverviewPage() {
  const { can } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [detailsRow, setDetailsRow] = useState<InventoryProductStockRow | null>(null)

  const filters: InventoryPageFilters = useMemo(
    () => filtersFromSearchParams(searchParams),
    [searchParams],
  )

  const valuationFilters = useMemo(() => toValuationFilters(filters), [filters])

  const setFilters = useCallback(
    (patch: Partial<InventoryPageFilters>) => {
      const next = { ...filters, ...patch }
      setSearchParams(filtersToSearchParams(next), { replace: true })
    },
    [filters, setSearchParams],
  )

  const setView = useCallback(
    (view: InventoryView) => setFilters({ view, page: 1 }),
    [setFilters],
  )

  const { data: branches = [] } = useQuery({
    queryKey: queryKeys.branches,
    queryFn: listAccessibleBranches,
  })

  const headOfficeId = branches.find((b) => b.is_central)?.id ?? null

  const summaryQuery = useQuery({
    queryKey: queryKeys.inventoryValuationSummary(valuationFilters),
    queryFn: () => getInventoryValuationSummary(valuationFilters),
    placeholderData: keepPreviousData,
  })

  const branchQuery = useQuery({
    queryKey: queryKeys.inventoryBranchSummary(filters.includeNonSaleable ?? false),
    queryFn: () => getInventoryBranchSummary(filters.includeNonSaleable ?? false),
    placeholderData: keepPreviousData,
  })

  const breakdownQuery = useQuery({
    queryKey: queryKeys.inventoryStockBreakdown({
      ...valuationFilters,
      page: filters.page,
      pageSize: PAGE_SIZE,
      sortBy: filters.sortBy,
      sortDirection: filters.sortDirection,
    }),
    queryFn: () =>
      getInventoryStockBreakdown({
        ...valuationFilters,
        page: filters.page,
        pageSize: PAGE_SIZE,
        sortBy: filters.sortBy,
        sortDirection: filters.sortDirection,
      }),
    enabled: filters.view === 'products',
    placeholderData: keepPreviousData,
  })

  const variantQuery = useQuery({
    queryKey: queryKeys.inventoryBalances({
      branchId: filters.branchId,
      search: filters.search,
      page: filters.page,
      view: 'variants',
    }),
    queryFn: () =>
      branchStock({
        branchId: filters.branchId,
        search: filters.search,
        page: filters.page,
        pageSize: PAGE_SIZE,
      }),
    enabled: filters.view === 'variants',
    placeholderData: keepPreviousData,
  })

  const lowStockQuery = useQuery({
    queryKey: queryKeys.lowStock({
      branchId: filters.branchId,
      search: filters.search,
      page: filters.page,
      view: 'low-stock',
    }),
    queryFn: () =>
      lowStock({
        branchId: filters.branchId,
        search: filters.search,
        page: filters.page,
        pageSize: PAGE_SIZE,
      }),
    enabled: filters.view === 'low-stock',
    placeholderData: keepPreviousData,
  })

  const canViewCost =
    breakdownQuery.data?.can_view_cost ??
    (can('inventory.valuation') || can('accounting.view') || can('products.manage_prices'))

  const summary = summaryQuery.data
  const showInitialLoading = summaryQuery.isLoading && !summary

  const variantRows = useMemo(() => {
    const items = variantQuery.data?.items ?? []
    const statusFilter = searchParams.get('status')
    if (!statusFilter || statusFilter === 'all') return items
    return items.filter((row) => {
      const available = row.available ?? Math.max(row.quantity - (row.qtyReserved ?? 0), 0)
      return matchesStockStatusFilter(statusFilter, available, row.reorderLevel, row.locationType)
    })
  }, [variantQuery.data?.items, searchParams])

  const totalPages = useMemo(() => {
    if (filters.view === 'products') {
      return Math.max(1, Math.ceil((breakdownQuery.data?.total_count ?? 0) / PAGE_SIZE))
    }
    if (filters.view === 'variants') {
      return Math.max(1, Math.ceil((variantQuery.data?.total ?? 0) / PAGE_SIZE))
    }
    if (filters.view === 'low-stock') {
      return Math.max(1, Math.ceil((lowStockQuery.data?.total ?? 0) / PAGE_SIZE))
    }
    return 1
  }, [filters.view, breakdownQuery.data, variantQuery.data, lowStockQuery.data])

  const exportCsv = () => {
    const rows = breakdownQuery.data?.items ?? []
    const headers = [
      'Product',
      'SKU',
      'Category',
      'Variants',
      'Available',
      'Reserved',
      ...(canViewCost ? ['Stock Cost', 'Potential Profit'] : []),
      'Selling Value',
      'Status',
    ]
    const data = rows.map((r) => [
      r.product_name,
      r.product_code ?? '',
      r.category ?? '',
      r.variant_count,
      r.available_quantity,
      r.reserved_quantity,
      ...(canViewCost ? [r.total_purchase_cost ?? '', r.potential_profit ?? ''] : []),
      r.total_stock_value,
      r.stock_status,
    ])
    downloadCsv(`inventory-${new Date().toISOString().slice(0, 10)}.csv`, headers, data)
  }

  const handleViewBranchStock = (branchId: string) => {
    setFilters({ branchId, view: 'products', page: 1 })
  }

  const viewLoading =
    (filters.view === 'products' && breakdownQuery.isFetching) ||
    (filters.view === 'variants' && variantQuery.isFetching) ||
    (filters.view === 'low-stock' && lowStockQuery.isFetching)

  const viewEmpty =
    (filters.view === 'products' && (breakdownQuery.data?.items.length ?? 0) === 0) ||
    (filters.view === 'variants' && variantRows.length === 0) ||
    (filters.view === 'low-stock' && (lowStockQuery.data?.items.length ?? 0) === 0)

  return (
    <div className="mx-auto w-full max-w-[1440px] min-w-0 space-y-4 overflow-x-hidden px-3 sm:px-4 lg:px-0">
      <InventoryPageHeader
        onExport={exportCsv}
        exportDisabled={filters.view !== 'products' || (breakdownQuery.data?.items.length ?? 0) === 0}
      />

      <InventoryFilterBar
        filters={filters}
        branches={branches}
        headOfficeId={headOfficeId}
        onChange={setFilters}
        onClear={() => setFilters(clearInventoryFilters())}
      />

      <InventoryViewSwitcher value={filters.view} onChange={setView} />

      {showInitialLoading ? <InventoryTableSkeleton /> : null}

      {summaryQuery.error ? (
        <InventoryEmptyState variant="error" onRetry={() => void summaryQuery.refetch()} />
      ) : null}

      {summary && !summaryQuery.error ? (
        <InventoryKpiGrid summary={summary} canViewCost={canViewCost} />
      ) : null}

      {summaryQuery.isFetching && summary ? (
        <p className="text-xs text-[#9CA3AF]">Updating summary…</p>
      ) : null}

      {filters.view === 'branches' ? (
        branchQuery.isLoading && !branchQuery.data ? (
          <p className="flex items-center gap-2 text-sm text-[#6B7280]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading branches…
          </p>
        ) : (
          <BranchStockTable
            rows={branchQuery.data ?? []}
            canViewCost={canViewCost}
            selectedBranchId={filters.branchId ?? null}
            onViewStock={handleViewBranchStock}
          />
        )
      ) : null}

      {filters.view === 'products' ? (
        <section className="space-y-3">
          {viewLoading && breakdownQuery.data ? (
            <p className="text-xs text-[#9CA3AF]">Refreshing products…</p>
          ) : null}
          <ProductStockTable
            rows={breakdownQuery.data?.items ?? []}
            canViewCost={canViewCost}
            isLoading={breakdownQuery.isLoading && !breakdownQuery.data}
            onViewDetails={setDetailsRow}
          />
          {viewEmpty && !breakdownQuery.isLoading ? (
            <InventoryEmptyState onClear={() => setFilters(clearInventoryFilters())} />
          ) : null}
        </section>
      ) : null}

      {filters.view === 'variants' ? (
        <section className="space-y-3">
          {viewLoading && variantQuery.data ? (
            <p className="text-xs text-[#9CA3AF]">Refreshing variants…</p>
          ) : null}
          <VariantStockTable
            rows={variantRows}
            isLoading={variantQuery.isLoading && !variantQuery.data}
          />
          {viewEmpty && !variantQuery.isLoading ? (
            <InventoryEmptyState onClear={() => setFilters(clearInventoryFilters())} />
          ) : null}
        </section>
      ) : null}

      {filters.view === 'low-stock' ? (
        <section className="space-y-3">
          {viewLoading && lowStockQuery.data ? (
            <p className="text-xs text-[#9CA3AF]">Refreshing low stock…</p>
          ) : null}
          <LowStockTable
            rows={lowStockQuery.data?.items ?? []}
            isLoading={lowStockQuery.isLoading && !lowStockQuery.data}
          />
          {viewEmpty && !lowStockQuery.isLoading ? (
            <InventoryEmptyState onClear={() => setFilters(clearInventoryFilters())} />
          ) : null}
        </section>
      ) : null}

      {filters.view !== 'branches' && totalPages > 1 ? (
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={filters.page <= 1}
            onClick={() => setFilters({ page: filters.page - 1 })}
          >
            Prev
          </Button>
          <span className="self-center text-sm text-[#6B7280]">
            Page {filters.page} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={filters.page >= totalPages}
            onClick={() => setFilters({ page: filters.page + 1 })}
          >
            Next
          </Button>
        </div>
      ) : null}

      <StockDetailsDrawer
        row={detailsRow}
        open={Boolean(detailsRow)}
        canViewCost={canViewCost}
        onOpenChange={(open) => {
          if (!open) setDetailsRow(null)
        }}
      />
    </div>
  )
}
