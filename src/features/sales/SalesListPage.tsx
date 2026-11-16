import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Plus, Columns3 } from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/features/auth/auth.context'
import { salesService, type SaleListFilters } from '@/services/sales.service'
import { SalesKpiRow } from './components/SalesKpiRow'
import { SalesAnalyticsRow } from './components/SalesAnalyticsRow'
import { SalesFiltersBar } from './components/SalesFiltersBar'
import { SalesTable, COLUMNS, type SaleRowActions } from './components/SalesTable'
import { SalesMobileCards } from './components/SalesMobileCards'
import { SalesBulkActions } from './components/SalesBulkActions'
import { toastRpcError } from '@/lib/errors/rpc-error'

function openPrint(path: string) {
  window.open(path, '_blank', 'noopener,noreferrer')
}

const PAGE_SIZE = 25

export function SalesListPage() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<SaleListFilters>({})
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['sales', 'kpis', filters.branchId],
    queryFn: () => salesService.getDashboardKpis({ branchId: filters.branchId }),
  })

  const { data: analytics } = useQuery({
    queryKey: ['sales', 'analytics', filters.branchId],
    queryFn: () => salesService.getAnalytics({ branchId: filters.branchId, days: 14 }),
  })

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['sales', 'list', filters],
    queryFn: () => salesService.list(filters),
  })

  const sorted = useMemo(() => {
    const list = [...rows]
    list.sort((a, b) => {
      const av = a[sortKey as keyof typeof a]
      const bv = b[sortKey as keyof typeof b]
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av
      }
      return sortDir === 'asc'
        ? String(av ?? '').localeCompare(String(bv ?? ''))
        : String(bv ?? '').localeCompare(String(av ?? ''))
    })
    return list
  }, [rows, sortKey, sortDir])

  const pageRows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['sales'] })
  }

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => salesService.softDelete(id, session.name),
    onSuccess: () => {
      invalidate()
      toast('Sale deleted — stock & finance reversed')
      setDeleteTarget(null)
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => salesService.bulkSoftDelete(ids, session.name),
    onSuccess: (result) => {
      invalidate()
      toast(`${result.length} sale(s) deleted`)
      setSelectedIds(new Set())
      setBulkDeleteOpen(false)
    },
  })

  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => salesService.duplicate(id, session.name),
    onSuccess: (sale) => {
      invalidate()
      toast(`Duplicated as ${sale.saleNo}`)
      navigate(`/sales/${sale.id}`)
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelectedIds(selectedIds.size === pageRows.length ? new Set() : new Set(pageRows.map((r) => r.id)))
  }

  const onSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const toggleColumn = (key: string) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const exportCsv = (ids?: string[]) => {
    const data = ids?.length ? sorted.filter((r) => ids.includes(r.id)) : sorted
    const header = ['Invoice', 'Customer', 'Branch', 'Salesperson', 'Channel', 'Total', 'Paid', 'Due', 'Status']
    const lines = data.map((r) =>
      [r.saleNo, r.customerName, r.branchName, r.salespersonName, r.channel, r.total, r.paidAmount, r.dueAmount, r.status]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    )
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sales-export-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast('Exported Excel/CSV')
  }

  const actions: SaleRowActions = {
    onView: (id) => navigate(`/sales/${id}`),
    onEdit: (id) => navigate(`/sales/${id}/edit`),
    onPrint: (id, type) => openPrint(`/print/sales/${id}/${type}`),
    onPayment: (id) => navigate(`/sales/${id}/collections`),
    onReturn: (id) => navigate(`/sales/${id}/return`),
    onDuplicate: (id) => duplicateMutation.mutate(id),
    onDelete: (id) => setDeleteTarget(id),
    onShare: (id) => {
      const row = sorted.find((r) => r.id === id)
      const text = encodeURIComponent(`Invoice ${row?.saleNo} · Total ৳${row?.total}`)
      window.open(`https://wa.me/?text=${text}`, '_blank')
    },
  }

  return (
    <PageShell
      title="Sales"
      description="Manage sales, invoices, returns and collections."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-full" onClick={() => exportCsv()}>
            <Download className="h-4 w-4" /> Export
          </Button>
          <Link to="/sales/new">
            <Button className="rounded-full">
              <Plus className="h-4 w-4" /> New Sale
            </Button>
          </Link>
        </div>
      }
    >
      {kpisLoading || !kpis ? (
        <LoadingSkeleton rows={2} height="h-24" />
      ) : (
        <SalesKpiRow {...kpis} />
      )}

      {analytics && (
        <SalesAnalyticsRow
          trend={analytics.trend}
          byChannel={analytics.byChannel}
          byPayment={analytics.byPayment}
        />
      )}

      <SalesFiltersBar
        filters={filters}
        onChange={(next) => {
          setFilters(next)
          setPage(1)
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[#6B7280]">{sorted.length} sales</p>
        <div className="relative">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium">
              <Columns3 className="h-3.5 w-3.5" /> Columns
            </summary>
            <div className="absolute right-0 z-20 mt-1 w-44 rounded-xl border bg-white p-2 shadow-lg">
              {COLUMNS.map((col) => (
                <label key={col.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-[#F8F6F2]">
                  <input
                    type="checkbox"
                    checked={!hiddenColumns.has(col.key)}
                    onChange={() => toggleColumn(col.key)}
                  />
                  {col.label}
                </label>
              ))}
            </div>
          </details>
        </div>
      </div>

      <SalesBulkActions
        count={selectedIds.size}
        onClear={() => setSelectedIds(new Set())}
        onPrintInvoices={() => {
          ;[...selectedIds].forEach((id) => openPrint(`/print/sales/${id}/a4`))
        }}
        onPrintPos={() => {
          ;[...selectedIds].forEach((id) => openPrint(`/print/sales/${id}/pos`))
        }}
        onPrintGift={() => {
          ;[...selectedIds].forEach((id) => openPrint(`/print/sales/${id}/gift-label`))
        }}
        onExportExcel={() => exportCsv([...selectedIds])}
        onExportPdf={() => {
          ;[...selectedIds].forEach((id) => openPrint(`/print/sales/${id}/a4`))
        }}
        onWhatsApp={() => {
          const first = sorted.find((r) => selectedIds.has(r.id))
          if (first) actions.onShare(first.id)
        }}
        onDelete={() => setBulkDeleteOpen(true)}
      />

      {isLoading ? (
        <LoadingSkeleton rows={6} height="h-12" />
      ) : sorted.length === 0 ? (
        <EmptyState title="No sales found" description="Adjust filters or create a new sale." />
      ) : (
        <>
          <SalesTable
            rows={pageRows}
            selectedIds={selectedIds}
            onToggle={toggleSelect}
            onToggleAll={toggleAll}
            actions={actions}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
            hiddenColumns={hiddenColumns}
          />
          <SalesMobileCards
            rows={pageRows}
            selectedIds={selectedIds}
            onToggle={toggleSelect}
            actions={actions}
          />
          <div className="flex items-center justify-between gap-3 text-sm">
            <p className="text-[#6B7280]">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
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
        </>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete sale?"
        description="This soft-deletes the list record only. For completed invoices use Void (stock, ledger, residual commission) or Correct sale — soft delete does not post financial reversals."
        confirmLabel="Delete Sale"
        variant="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Delete ${selectedIds.size} sales?`}
        description="Soft-deletes list records only. Completed sales requiring financial reversal must be Voided or Corrected individually."
        confirmLabel="Delete Selected"
        variant="danger"
        loading={bulkDeleteMutation.isPending}
        onConfirm={() => bulkDeleteMutation.mutate([...selectedIds])}
      />
    </PageShell>
  )
}
