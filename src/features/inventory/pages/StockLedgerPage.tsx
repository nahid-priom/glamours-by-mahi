import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/features/auth/auth-session'
import { formatBDT } from '@/lib/format'
import { queryKeys } from '@/lib/query/keys'
import {
  StockLedgerFilterBar,
  type StockLedgerUiFilters,
} from '../components/StockLedgerFilterBar'
import {
  ledger,
  listStockLocations,
  type LedgerListItem,
} from '../repositories/inventory.repository'

const PAGE_SIZE = 50

const EMPTY_FILTERS: StockLedgerUiFilters = {
  variantId: null,
  variantLabel: null,
  locationId: null,
  movementTypes: [],
  search: '',
  fromDate: '',
  toDate: '',
}

function shortId(id: string | null | undefined) {
  if (!id) return ''
  return id.slice(0, 8)
}

function countActiveFilters(f: StockLedgerUiFilters, productId: string | null) {
  let n = 0
  if (f.variantId) n += 1
  if (productId) n += 1
  if (f.locationId) n += 1
  if (f.movementTypes.length) n += 1
  if (f.search.trim()) n += 1
  if (f.fromDate) n += 1
  if (f.toDate) n += 1
  return n
}

export function StockLedgerPage() {
  const { activeBranchId, can } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [page, setPage] = useState(1)

  const productId = searchParams.get('productId')
  const urlVariantId = searchParams.get('variantId')
  const urlFrom = searchParams.get('from') ?? ''
  const urlTo = searchParams.get('to') ?? ''

  const [filters, setFilters] = useState<StockLedgerUiFilters>(() => ({
    ...EMPTY_FILTERS,
    variantId: urlVariantId,
    fromDate: urlFrom,
    toDate: urlTo,
  }))

  const canViewCost =
    can('inventory.valuation') || can('accounting.view') || can('products.manage_prices')

  const birthToDate = Boolean(filters.variantId)

  const queryFilters = useMemo(
    () => ({
      branchId: activeBranchId,
      variantId: filters.variantId,
      productId: filters.variantId ? null : productId,
      locationId: filters.locationId,
      movementTypes: filters.movementTypes.length ? filters.movementTypes : undefined,
      search: filters.variantId ? undefined : filters.search.trim() || undefined,
      fromDate: filters.fromDate || null,
      toDate: filters.toDate || null,
      sortDir: (birthToDate ? 'asc' : 'desc') as 'asc' | 'desc',
      page,
      pageSize: PAGE_SIZE,
    }),
    [activeBranchId, filters, productId, birthToDate, page],
  )

  const { data: locations = [] } = useQuery({
    queryKey: queryKeys.stockLocations(activeBranchId ?? ''),
    queryFn: () => listStockLocations(activeBranchId!),
    enabled: Boolean(activeBranchId),
  })

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.stockLedger(queryFilters),
    queryFn: () => ledger(queryFilters),
    enabled: Boolean(activeBranchId),
  })

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE))
  // Prefer stable query reference — avoid `?? []` which allocates every render.
  const items = data?.items

  const syncUrl = useCallback(
    (next: StockLedgerUiFilters, clearProduct = false) => {
      const params = new URLSearchParams()
      if (next.variantId) params.set('variantId', next.variantId)
      else if (productId && !clearProduct) params.set('productId', productId)
      if (next.fromDate) params.set('from', next.fromDate)
      if (next.toDate) params.set('to', next.toDate)
      setSearchParams(params, { replace: true })
    },
    [productId, setSearchParams],
  )

  const onFilterChange = (patch: Partial<StockLedgerUiFilters>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch }
      syncUrl(next, Boolean(patch.variantId))
      return next
    })
    setPage(1)
  }

  const onClear = () => {
    setFilters(EMPTY_FILTERS)
    setSearchParams({}, { replace: true })
    setPage(1)
  }

  const activeCount = countActiveFilters(filters, birthToDate ? null : productId)

  const summary = useMemo(() => {
    if (!birthToDate || !items?.length) return null
    const opening = items.find((r) => r.movement_type === 'opening')
    const netDelta = items.reduce((s, r) => s + Number(r.quantity_delta), 0)
    const last = items[items.length - 1]
    return {
      openingQty: opening ? Number(opening.quantity_after) : null,
      netDelta,
      latestAfter: last ? Number(last.quantity_after) : null,
      locationName: last?.locationName,
    }
  }, [birthToDate, items])

  const headerTitle = birthToDate
    ? filters.variantLabel ||
      (items?.[0]
        ? `${items[0].productName ?? 'Product'}${items[0].variantName ? ` · ${items[0].variantName}` : ''}`
        : 'Variant history')
    : 'Stock ledger'

  return (
    <div className="mx-auto w-full max-w-7xl min-w-0 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#111827]">{headerTitle}</h1>
        <p className="text-sm text-[#6B7280]">
          {birthToDate
            ? 'Birth-to-date movement history for this variant.'
            : productId
              ? 'Product-scoped immutable movement history.'
              : 'Immutable movement history with advanced filters.'}
        </p>
        {birthToDate && items?.[0]?.sku ? (
          <p className="mt-0.5 text-xs text-[#9CA3AF]">SKU {items[0].sku}</p>
        ) : null}
      </div>

      {!activeBranchId ? (
        <p className="text-sm text-[#E11D48]">Select a branch to view the ledger.</p>
      ) : null}

      <StockLedgerFilterBar
        filters={filters}
        locations={locations}
        onChange={onFilterChange}
        onClear={onClear}
        activeCount={activeCount}
      />

      {summary ? (
        <div className="flex flex-wrap gap-2 text-xs">
          {summary.openingQty != null ? (
            <span className="rounded-lg border border-border bg-white px-2.5 py-1 text-[#4B5563]">
              Opening after <strong className="text-[#111827]">{summary.openingQty}</strong>
            </span>
          ) : null}
          <span className="rounded-lg border border-border bg-white px-2.5 py-1 text-[#4B5563]">
            Net Δ{' '}
            <strong className={summary.netDelta < 0 ? 'text-[#E11D48]' : 'text-emerald-700'}>
              {summary.netDelta > 0 ? '+' : ''}
              {summary.netDelta}
            </strong>
          </span>
          {summary.latestAfter != null ? (
            <span className="rounded-lg border border-border bg-white px-2.5 py-1 text-[#4B5563]">
              Latest after <strong className="text-[#111827]">{summary.latestAfter}</strong>
              {summary.locationName ? ` · ${summary.locationName}` : ''}
            </span>
          ) : null}
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-[#6B7280]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading ledger…
        </div>
      ) : null}
      {error ? <p className="text-sm text-[#E11D48]">Failed to load ledger.</p> : null}

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              {!birthToDate ? <TableHead>Product</TableHead> : null}
              <TableHead>Type</TableHead>
              <TableHead>Location</TableHead>
              {birthToDate ? <TableHead className="text-right">Before</TableHead> : null}
              <TableHead className="text-right">Δ</TableHead>
              <TableHead className="text-right">After</TableHead>
              {canViewCost ? <TableHead className="text-right">Cost</TableHead> : null}
              <TableHead>Ref</TableHead>
              {birthToDate ? <TableHead>Notes</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(items ?? []).map((row) => (
              <LedgerRow
                key={row.id}
                row={row}
                birthToDate={birthToDate}
                canViewCost={canViewCost}
              />
            ))}
          </TableBody>
        </Table>
        {!isLoading && activeBranchId && (items?.length ?? 0) === 0 ? (
          <p className="p-6 text-center text-sm text-[#6B7280]">No ledger entries.</p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-[#9CA3AF]">
          {data?.total ?? 0} entr{(data?.total ?? 0) === 1 ? 'y' : 'ies'}
          {totalPages > 1 ? ` · page ${page} of ${totalPages}` : ''}
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Prev
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}

function LedgerRow({
  row,
  birthToDate,
  canViewCost,
}: {
  row: LedgerListItem
  birthToDate: boolean
  canViewCost: boolean
}) {
  const delta = Number(row.quantity_delta)
  const ref =
    [row.reference_type, row.reference_id ? shortId(row.reference_id) : null]
      .filter(Boolean)
      .join(' · ') || '—'

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap text-xs text-[#6B7280]">
        {new Date(row.occurred_at).toLocaleString()}
      </TableCell>
      {!birthToDate ? (
        <TableCell>
          <p className="font-medium">
            {row.productName ?? '—'}
            {row.variantName ? (
              <span className="font-normal text-[#6B7280]"> · {row.variantName}</span>
            ) : null}
          </p>
          <p className="text-xs text-[#9CA3AF]">{row.sku}</p>
        </TableCell>
      ) : null}
      <TableCell className="whitespace-nowrap text-sm">{row.movement_type}</TableCell>
      <TableCell className="text-sm text-[#4B5563]">{row.locationName ?? '—'}</TableCell>
      {birthToDate ? (
        <TableCell className="text-right tabular-nums">{row.quantity_before}</TableCell>
      ) : null}
      <TableCell
        className={`text-right font-medium tabular-nums ${
          delta < 0 ? 'text-[#E11D48]' : 'text-emerald-600'
        }`}
      >
        {delta > 0 ? '+' : ''}
        {row.quantity_delta}
      </TableCell>
      <TableCell className="text-right tabular-nums">{row.quantity_after}</TableCell>
      {canViewCost ? (
        <TableCell className="text-right text-xs tabular-nums text-[#4B5563]">
          {row.unit_cost != null ? formatBDT(Number(row.unit_cost)) : '—'}
          {row.total_cost != null ? (
            <span className="block text-[10px] text-[#9CA3AF]">
              Σ {formatBDT(Number(row.total_cost))}
            </span>
          ) : null}
        </TableCell>
      ) : null}
      <TableCell className="max-w-[8rem] truncate text-xs text-[#9CA3AF]" title={ref}>
        {ref}
      </TableCell>
      {birthToDate ? (
        <TableCell className="max-w-[10rem] truncate text-xs text-[#6B7280]" title={row.notes ?? ''}>
          {row.notes ?? '—'}
        </TableCell>
      ) : null}
    </TableRow>
  )
}
