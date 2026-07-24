import { useCallback, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { Download, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/features/auth/auth-session'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { queryKeys } from '@/lib/query/keys'
import { BranchStockSummary } from '../components/BranchStockSummary'
import {
  InventoryKpiCard,
  MoneyValue,
  QuantityValue,
  ValuationInfoTooltip,
} from '../components/InventoryValuationUi'
import { StockStatusBadge } from '../components/StockStatusBadge'
import {
  getInventoryBranchSummary,
  getInventoryStockBreakdown,
  getInventoryValuationSummary,
  listAccessibleBranches,
  type InventoryValuationFilters,
} from '../repositories/inventory-valuation.repository'

const STOCK_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'in_stock', label: 'In stock' },
  { value: 'low_stock', label: 'Low stock' },
  { value: 'out_of_stock', label: 'Out of stock' },
] as const

function filtersFromParams(params: URLSearchParams): InventoryValuationFilters & { page: number } {
  const branch = params.get('branch')
  return {
    branchId: branch === 'all' || !branch ? null : branch,
    search: params.get('q') ?? undefined,
    stockStatus: (params.get('status') as InventoryValuationFilters['stockStatus']) || null,
    includeNonSaleable: params.get('allLocations') === '1',
    page: Math.max(1, Number(params.get('page') ?? 1) || 1),
  }
}

export function StockOverviewPage() {
  const { can } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchInput, setSearchInput] = useState(searchParams.get('q') ?? '')

  const filters = useMemo(() => filtersFromParams(searchParams), [searchParams])

  const setFilters = useCallback(
    (patch: Partial<InventoryValuationFilters & { page: number }>) => {
      const next = new URLSearchParams(searchParams)
      if (patch.branchId !== undefined) {
        if (patch.branchId) next.set('branch', patch.branchId)
        else next.set('branch', 'all')
      }
      if (patch.search !== undefined) {
        if (patch.search) next.set('q', patch.search)
        else next.delete('q')
      }
      if (patch.stockStatus !== undefined) {
        if (patch.stockStatus) next.set('status', patch.stockStatus)
        else next.delete('status')
      }
      if (patch.includeNonSaleable !== undefined) {
        if (patch.includeNonSaleable) next.set('allLocations', '1')
        else next.delete('allLocations')
      }
      if (patch.page !== undefined) {
        if (patch.page > 1) next.set('page', String(patch.page))
        else next.delete('page')
      }
      setSearchParams(next, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  const { data: branches = [] } = useQuery({
    queryKey: queryKeys.branches,
    queryFn: listAccessibleBranches,
  })

  const headOfficeId = branches.find((b) => b.is_central)?.id ?? null

  const branchSelectValue = useMemo(() => {
    if (!filters.branchId) return 'all'
    if (headOfficeId && filters.branchId === headOfficeId) return 'ho'
    return filters.branchId
  }, [filters.branchId, headOfficeId])

  const summaryQuery = useQuery({
    queryKey: queryKeys.inventoryValuationSummary(filters),
    queryFn: () => getInventoryValuationSummary(filters),
    placeholderData: keepPreviousData,
  })

  const branchQuery = useQuery({
    queryKey: queryKeys.inventoryBranchSummary(filters.includeNonSaleable ?? false),
    queryFn: () => getInventoryBranchSummary(filters.includeNonSaleable ?? false),
  })

  const breakdownQuery = useQuery({
    queryKey: queryKeys.inventoryStockBreakdown({ ...filters, pageSize: 20 }),
    queryFn: () =>
      getInventoryStockBreakdown({
        ...filters,
        page: filters.page,
        pageSize: 20,
        sortBy: 'stock_value',
        sortDirection: 'desc',
      }),
    placeholderData: keepPreviousData,
  })

  const canViewCost =
    breakdownQuery.data?.can_view_cost ??
    (can('inventory.valuation') ||
      can('accounting.view') ||
      can('products.manage_prices'))

  const summary = summaryQuery.data
  const totalPages = Math.max(
    1,
    Math.ceil((breakdownQuery.data?.total_count ?? 0) / (breakdownQuery.data?.page_size ?? 20)),
  )

  const exportCsv = () => {
    const rows = breakdownQuery.data?.items ?? []
    const header = [
      'Product',
      'Code',
      'Category',
      'Variants',
      'Qty',
      'Available',
      ...(canViewCost ? ['Purchase cost', 'Profit'] : []),
      'Selling value',
      'Status',
    ]
    const lines = rows.map((r) =>
      [
        r.product_name,
        r.product_code ?? '',
        r.category ?? '',
        r.variant_count,
        r.total_quantity,
        r.available_quantity,
        ...(canViewCost ? [r.total_purchase_cost ?? '', r.potential_profit ?? ''] : []),
        r.total_stock_value,
        r.stock_status,
      ].join(','),
    )
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inventory-valuation-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] min-w-0 space-y-6 overflow-x-hidden px-1">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-[#111827] sm:text-2xl">Inventory overview</h1>
          <p className="mt-1 max-w-2xl text-sm text-[#6B7280]">
            আপনার মোট স্টক, ক্রয়মূল্য ও বিক্রয়মূল্য — শাখা ও ভ্যারিয়েন্ট অনুযায়ী। সব মান
            সার্ভার-সাইড গণনা করা হয়।
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PermissionGate permission="inventory.adjust">
            <Button asChild size="sm" variant="outline">
              <Link to="/inventory/adjustments">Adjust stock</Link>
            </Button>
          </PermissionGate>
          <PermissionGate permission="inventory.transfer">
            <Button asChild size="sm" variant="outline">
              <Link to="/inventory/transfers/new">Transfer</Link>
            </Button>
          </PermissionGate>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!breakdownQuery.data?.items.length}>
            <Download className="mr-1.5 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid gap-3 rounded-xl border border-border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-medium text-[#6B7280]">
          Branch
          <select
            className="mt-1 block h-10 w-full rounded-lg border border-border bg-white px-3 text-sm"
            value={branchSelectValue}
            onChange={(e) => {
              const v = e.target.value
              if (v === 'all') setFilters({ branchId: null, page: 1 })
              else if (v === 'ho' && headOfficeId) setFilters({ branchId: headOfficeId, page: 1 })
              else setFilters({ branchId: v, page: 1 })
            }}
          >
            <option value="all">All accessible branches</option>
            {headOfficeId ? <option value="ho">Head Office</option> : null}
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {b.is_central ? ' (HO)' : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-medium text-[#6B7280]">
          Stock status
          <select
            className="mt-1 block h-10 w-full rounded-lg border border-border bg-white px-3 text-sm"
            value={filters.stockStatus ?? ''}
            onChange={(e) =>
              setFilters({
                stockStatus: (e.target.value || null) as InventoryValuationFilters['stockStatus'],
                page: 1,
              })
            }
          >
            {STOCK_STATUS_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-end gap-2 text-sm text-[#374151] sm:col-span-2">
          <input
            type="checkbox"
            checked={Boolean(filters.includeNonSaleable)}
            onChange={(e) => setFilters({ includeNonSaleable: e.target.checked, page: 1 })}
            className="h-4 w-4 accent-[#FF3F7F]"
          />
          Include damaged / quarantine locations
        </label>

        <div className="relative sm:col-span-2 lg:col-span-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
          <Input
            placeholder="Search product, SKU, barcode…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setFilters({ search: searchInput.trim() || undefined, page: 1 })
            }}
            onBlur={() => setFilters({ search: searchInput.trim() || undefined, page: 1 })}
            className="pl-10"
          />
        </div>
      </div>

      {(summaryQuery.isLoading || summaryQuery.isFetching) && !summary ? (
        <div className="flex items-center gap-2 text-sm text-[#6B7280]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading valuation…
        </div>
      ) : null}
      {summaryQuery.error ? (
        <p className="text-sm text-[#E11D48]">Failed to load inventory summary.</p>
      ) : null}

      {/* Primary KPIs */}
      {summary ? (
        <>
          <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 xl:grid-cols-4">
            <InventoryKpiCard
              accent="primary"
              label={
                <ValuationInfoTooltip
                  label="মোট স্টক পরিমাণ"
                  formula="হাতে থাকা ধনাত্মক পরিমাণের যোগফল"
                />
              }
              value={summary.total_stock_quantity.toLocaleString('en-BD')}
              hint={`${summary.total_products} products · ${summary.total_variants} variants`}
            />
            <InventoryKpiCard
              accent="cost"
              label={
                <ValuationInfoTooltip
                  label="বর্তমান স্টকের ক্রয়মূল্য"
                  formula="হাতে থাকা পরিমাণ × গড় ক্রয়মূল্য (WAC)"
                />
              }
              value={
                canViewCost && summary.total_stock_purchase_cost != null
                  ? `৳${summary.total_stock_purchase_cost.toLocaleString('en-BD')}`
                  : '—'
              }
              hint={
                canViewCost && summary.valuation_fallback_count > 0
                  ? `${summary.valuation_fallback_count} variant(s) use fallback cost`
                  : undefined
              }
            />
            <InventoryKpiCard
              accent="value"
              label={
                <ValuationInfoTooltip
                  label="বর্তমান স্টকের বিক্রয়মূল্য"
                  formula="হাতে থাকা পরিমাণ × কার্যকর বিক্রয়মূল্য"
                />
              }
              value={`৳${summary.total_stock_value.toLocaleString('en-BD')}`}
            />
            <InventoryKpiCard
              accent="profit"
              label={
                <ValuationInfoTooltip
                  label="সম্ভাব্য মোট লাভ"
                  formula="বিক্রয়মূল্য − ক্রয়মূল্য"
                />
              }
              value={
                canViewCost && summary.potential_gross_profit != null
                  ? `৳${summary.potential_gross_profit.toLocaleString('en-BD')}`
                  : '—'
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-border bg-white px-3 py-2 text-center">
              <p className="text-[10px] uppercase text-[#9CA3AF]">মোট পণ্য</p>
              <p className="text-lg font-bold">{summary.total_products}</p>
            </div>
            <div className="rounded-lg border border-border bg-white px-3 py-2 text-center">
              <p className="text-[10px] uppercase text-[#9CA3AF]">মোট ভ্যারিয়েন্ট</p>
              <p className="text-lg font-bold">{summary.total_variants}</p>
            </div>
            <div className="rounded-lg border border-border bg-white px-3 py-2 text-center">
              <p className="text-[10px] uppercase text-[#9CA3AF]">কম স্টক</p>
              <p className="text-lg font-bold text-[#C2410C]">{summary.low_stock_variants}</p>
            </div>
            <div className="rounded-lg border border-border bg-white px-3 py-2 text-center">
              <p className="text-[10px] uppercase text-[#9CA3AF]">স্টক শেষ</p>
              <p className="text-lg font-bold text-[#DC2626]">{summary.out_of_stock_variants}</p>
            </div>
          </div>
        </>
      ) : null}

      {/* Branch summary */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[#111827]">Branch stock summary</h2>
        {branchQuery.isLoading ? (
          <p className="text-sm text-[#6B7280]">Loading branches…</p>
        ) : (
          <BranchStockSummary
            rows={branchQuery.data ?? []}
            canViewCost={canViewCost}
            selectedBranchId={filters.branchId ?? null}
            onSelectBranch={(id) => setFilters({ branchId: id, page: 1 })}
            orgPurchaseCost={summary?.total_stock_purchase_cost}
          />
        )}
      </section>

      {/* Product breakdown */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-[#111827]">Products by stock value</h2>
          <p className="text-sm text-[#6B7280]">
            {breakdownQuery.data?.total_count ?? 0} products
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Avail.</TableHead>
                {canViewCost ? <TableHead className="text-right">Purchase cost</TableHead> : null}
                <TableHead className="text-right">Selling value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(breakdownQuery.data?.items ?? []).map((row) => (
                <TableRow key={row.product_id}>
                  <TableCell>
                    <p className="font-medium">{row.product_name}</p>
                    <p className="text-xs text-[#9CA3AF]">
                      {row.product_code ?? '—'} · {row.variant_count} variant(s)
                      {row.category ? ` · ${row.category}` : ''}
                    </p>
                  </TableCell>
                  <TableCell className="text-right">
                    <QuantityValue qty={row.total_quantity} />
                  </TableCell>
                  <TableCell className="text-right">{row.available_quantity}</TableCell>
                  {canViewCost ? (
                    <TableCell className="text-right">
                      <MoneyValue amount={row.total_purchase_cost} />
                    </TableCell>
                  ) : null}
                  <TableCell className="text-right">
                    <MoneyValue amount={row.total_stock_value} />
                  </TableCell>
                  <TableCell>
                    <StockStatusBadge status={row.stock_status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="ghost">
                      <Link to={`/products/${row.product_id}/edit`}>Edit</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!breakdownQuery.isLoading && (breakdownQuery.data?.items.length ?? 0) === 0 ? (
            <p className="p-8 text-center text-sm text-[#6B7280]">No products match these filters.</p>
          ) : null}
        </div>

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
      </section>
    </div>
  )
}
