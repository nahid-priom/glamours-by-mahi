import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Plus, Printer, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { useToast } from '@/components/ui/toast'
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '@/lib/storage'
import { SalesHistoryFiltersBar } from '../components/SalesHistoryFiltersBar'
import { SalesHistoryKpis } from '../components/SalesHistoryKpis'
import { SalesHistoryMobileCards } from '../components/SalesHistoryMobileCards'
import { SalesHistoryTable } from '../components/SalesHistoryTable'
import {
  downloadSalesCsv,
  useSalesHistoryFilters,
  useSalesHistoryQuery,
  useSalesKpisQuery,
} from '../hooks/use-sales-list'
import { filtersToSearchParams } from '../schemas/sale-filters.schema'
import { toastRpcError } from '@/lib/errors/rpc-error'
import {
  DEFAULT_VISIBLE_COLUMNS,
  FIXED_COLUMNS,
  type SalesColumnKey,
} from '../types/sale.types'

const COLUMN_LABELS: Partial<Record<SalesColumnKey, string>> = {
  customer: 'Customer',
  items: 'Items',
  paid: 'Paid',
  due: 'Due',
}

function loadVisibleColumns(): SalesColumnKey[] {
  const saved = getStorageItem<SalesColumnKey[] | null>(STORAGE_KEYS.salesColumnVisibility, null)
  if (!saved?.length) return DEFAULT_VISIBLE_COLUMNS
  const fixed = new Set(FIXED_COLUMNS)
  const next = DEFAULT_VISIBLE_COLUMNS.filter((key) => fixed.has(key) || saved.includes(key))
  return next.length ? next : DEFAULT_VISIBLE_COLUMNS
}

function buildPageList(current: number, total: number): number[] {
  const pages: number[] = []
  const start = Math.max(1, current - 2)
  const end = Math.min(total, start + 4)
  for (let i = start; i <= end; i += 1) pages.push(i)
  return pages
}

export function SalesHistoryPage() {
  const { toast } = useToast()
  const { filters, setFilters, clearFilters } = useSalesHistoryFilters()
  const listQuery = useSalesHistoryQuery(filters)
  const kpisQuery = useSalesKpisQuery(filters)
  const [visible, setVisible] = useState<SalesColumnKey[]>(loadVisibleColumns)
  const [exporting, setExporting] = useState(false)

  const total = listQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize))
  const rows = listQuery.data?.items ?? []

  const hasActiveFilters =
    Boolean(filters.search.trim()) ||
    filters.preset !== 'this_month' ||
    Boolean(filters.paymentStatus) ||
    Boolean(filters.status) ||
    Boolean(filters.cashierId) ||
    Boolean(filters.paymentMethod) ||
    Boolean(filters.categoryId) ||
    filters.dueOnly ||
    filters.sort !== 'date_desc'

  const optionalColumns = useMemo(
    () => (Object.keys(COLUMN_LABELS) as SalesColumnKey[]),
    [],
  )

  const toggleColumn = (key: SalesColumnKey) => {
    if (FIXED_COLUMNS.includes(key)) return
    setVisible((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
      const ordered = DEFAULT_VISIBLE_COLUMNS.filter((k) => next.includes(k))
      setStorageItem(STORAGE_KEYS.salesColumnVisibility, ordered)
      return ordered
    })
  }

  const onExport = async () => {
    setExporting(true)
    try {
      await downloadSalesCsv(filters)
      toast('Export downloaded')
    } catch (e) {
      toastRpcError(toast, e, 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  const onPrintReport = () => {
    const qs = filtersToSearchParams(filters).toString()
    window.open(`/print/sales/report${qs ? `?${qs}` : ''}`, '_blank', 'noopener,noreferrer')
  }

  const rangeStart = total === 0 ? 0 : (filters.page - 1) * filters.pageSize + 1
  const rangeEnd = Math.min(filters.page * filters.pageSize, total)

  return (
    <div className="mx-auto w-full max-w-7xl min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Sales</h1>
          <p className="text-sm text-text-muted">
            View all sales, payments and outstanding balances in one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={exporting}
            onClick={() => void onExport()}
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onPrintReport}>
            <Printer className="h-3.5 w-3.5" />
            Print Report
          </Button>
          <PermissionGate permission="pos.create">
            <Button size="sm" asChild>
              <Link to="/sales/pos">
                <Plus className="h-3.5 w-3.5" />
                New Sale
              </Link>
            </Button>
          </PermissionGate>
        </div>
      </div>

      <SalesHistoryKpis data={kpisQuery.data} loading={kpisQuery.isLoading} />

      <SalesHistoryFiltersBar filters={filters} onChange={setFilters} onClear={clearFilters} />

      {listQuery.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full rounded-xl" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : listQuery.error ? (
        <div className="rounded-2xl border border-dashed border-border bg-white p-10 text-center">
          <p className="font-medium text-text-primary">Unable to load sales data.</p>
          <Button className="mt-3" variant="outline" onClick={() => void listQuery.refetch()}>
            Try Again
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white p-10 text-center">
          {hasActiveFilters ? (
            <>
              <p className="font-medium text-text-primary">
                No sales match the selected filters.
              </p>
              <Button className="mt-3" variant="outline" onClick={clearFilters}>
                Clear All Filters
              </Button>
            </>
          ) : (
            <>
              <p className="font-medium text-text-primary">No sales have been created yet.</p>
              <PermissionGate permission="pos.create">
                <Button className="mt-3" asChild>
                  <Link to="/sales/pos">Create New Sale</Link>
                </Button>
              </PermissionGate>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="hidden justify-end md:flex">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="sm" variant="ghost" className="text-text-muted">
                  <Settings2 className="h-3.5 w-3.5" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>Visible Columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {optionalColumns.map((key) => (
                  <DropdownMenuCheckboxItem
                    key={key}
                    checked={visible.includes(key)}
                    onCheckedChange={() => toggleColumn(key)}
                  >
                    {COLUMN_LABELS[key]}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <SalesHistoryTable rows={rows} visible={visible} />
          <SalesHistoryMobileCards rows={rows} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-text-muted">
              {rangeStart.toLocaleString('en-US')}–{rangeEnd.toLocaleString('en-US')} of{' '}
              {total.toLocaleString('en-US')} sales
            </p>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                disabled={filters.page <= 1}
                onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
              >
                Previous
              </Button>
              {buildPageList(filters.page, totalPages).map((p) => (
                <Button
                  key={p}
                  size="sm"
                  variant={p === filters.page ? 'default' : 'outline'}
                  className="min-w-9"
                  onClick={() => setFilters({ ...filters, page: p })}
                >
                  {p}
                </Button>
              ))}
              <Button
                size="sm"
                variant="outline"
                disabled={filters.page >= totalPages}
                onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
