import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageShell } from '@/components/layout/PageShell'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AppDateRangeField } from '@/components/date-picker'
import { KpiGrid } from '@/components/common/KpiGrid'
import { EntityToolbar } from '@/components/common/EntityToolbar'
import { ActionDropdown, type ActionItem } from '@/components/common/ActionDropdown'
import { MobileEntityCard } from '@/components/common/MobileEntityCard'
import { SearchInput } from '@/components/shared/SearchInput'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useToast } from '@/components/ui/toast'
import { invoicesService } from './invoices.service'
import { InvoiceDetailsDrawer } from './InvoiceDetailsDrawer'
import { formatBDT, formatDateShort } from '@/lib/format'
import { MOCK_STORES } from '@/lib/mock-data'
import type { Invoice, InvoiceStatus } from './invoices.types'
import { cn } from '@/lib/utils'

const statusVariant: Record<InvoiceStatus, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  draft: 'default',
  issued: 'info',
  paid: 'success',
  void: 'danger',
}

export function InvoicesPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<InvoiceStatus | 'all'>('all')
  const [store, setStore] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [selected, setSelected] = useState<Invoice | null>(null)
  const [voidTarget, setVoidTarget] = useState<Invoice | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<Invoice | null>(null)

  const filters = useMemo(
    () => ({
      search,
      status,
      store,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      include_deleted: showArchived,
    }),
    [search, status, store, dateFrom, dateTo, showArchived],
  )

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices', filters],
    queryFn: () => invoicesService.getInvoices(filters),
  })

  const { data: stats } = useQuery({
    queryKey: ['invoices', 'stats'],
    queryFn: () => invoicesService.getStats(),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['invoices'] })

  const markPaidMutation = useMutation({
    mutationFn: (id: string) => invoicesService.markPaid(id),
    onSuccess: () => { invalidate(); toast('Invoice marked as paid') },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const voidMutation = useMutation({
    mutationFn: (id: string) => invoicesService.void(id),
    onSuccess: () => { invalidate(); toast('Invoice voided'); setVoidTarget(null) },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => invoicesService.softDelete(id),
    onSuccess: () => { invalidate(); toast('Invoice archived'); setArchiveTarget(null) },
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => invoicesService.restore(id),
    onSuccess: () => { invalidate(); toast('Invoice restored') },
  })

  const getActions = (invoice: Invoice): ActionItem[] => {
    const items: ActionItem[] = [
      { label: 'View', onClick: () => setSelected(invoice) },
      {
        label: 'Print',
        onClick: () => window.open(`/print/orders/${invoice.order_id}/invoice`, '_blank'),
      },
    ]
    if (invoice.status === 'issued') {
      items.push({
        label: 'Mark Paid',
        onClick: () => markPaidMutation.mutate(invoice.id),
      })
    }
    if (invoice.status !== 'void' && invoice.status !== 'paid') {
      items.push({ label: 'Void', onClick: () => setVoidTarget(invoice), variant: 'danger' as const })
    }
    items.push({ label: 'sep', onClick: () => {}, separator: true })
    if (invoice.deleted_at) {
      items.push({ label: 'Restore', onClick: () => restoreMutation.mutate(invoice.id) })
    } else {
      items.push({
        label: 'Archive',
        onClick: () => setArchiveTarget(invoice),
        variant: 'danger' as const,
      })
    }
    return items
  }

  const kpis = [
    { label: 'Total Invoices', value: stats?.total ?? 0 },
    { label: 'Issued', value: stats?.issued ?? 0, color: 'text-blue-600' },
    { label: 'Paid', value: stats?.paid ?? 0, color: 'text-success' },
    { label: 'Void', value: stats?.void ?? 0, color: 'text-danger' },
    { label: 'Total Amount', value: formatBDT(stats?.total_amount ?? 0) },
  ]

  return (
    <PageShell title="Invoices" description="Invoice management and bulk printing">
      <KpiGrid items={kpis} columns={5} />

      <EntityToolbar
        search={
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search invoice, order, or customer..."
          />
        }
        filters={
          <>
            <Select value={status} onValueChange={(v) => setStatus(v as InvoiceStatus | 'all')}>
              <SelectTrigger className="h-11 w-full sm:w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="issued">Issued</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="void">Void</SelectItem>
              </SelectContent>
            </Select>
            <Select value={store} onValueChange={setStore}>
              <SelectTrigger className="h-11 w-full sm:w-40">
                <SelectValue placeholder="Store" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stores</SelectItem>
                {MOCK_STORES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <AppDateRangeField
              from={dateFrom}
              to={dateTo}
              onChange={({ from, to }) => {
                setDateFrom(from)
                setDateTo(to)
              }}
              className="w-full sm:w-auto sm:min-w-[14rem]"
            />
            <label className="flex items-center gap-2 text-xs text-text-muted">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              Archived
            </label>
          </>
        }
      />

      <Card>
        <CardContent className="overflow-hidden p-0">
          {isLoading ? (
            <LoadingSkeleton />
          ) : !invoices?.length ? (
            <EmptyState
              title="No invoices found"
              description="Invoices are generated from orders or appear here after bulk print."
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-slate-50 text-left text-xs text-text-muted">
                      <th className="px-4 py-3 font-medium sm:px-5">Invoice</th>
                      <th className="px-4 py-3 font-medium sm:px-5">Customer</th>
                      <th className="px-4 py-3 font-medium sm:px-5">Order</th>
                      <th className="px-4 py-3 font-medium sm:px-5">Amount</th>
                      <th className="px-4 py-3 font-medium sm:px-5">Status</th>
                      <th className="px-4 py-3 font-medium sm:px-5">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr
                        key={inv.id}
                        className={cn(
                          'border-b border-border/50 hover:bg-slate-50/50',
                          inv.deleted_at && 'opacity-60',
                        )}
                      >
                        <td className="px-4 py-3 sm:px-5">
                          <button
                            type="button"
                            className="font-medium text-primary hover:underline"
                            onClick={() => setSelected(inv)}
                          >
                            {inv.invoice_no}
                          </button>
                          <p className="text-xs text-text-muted">{formatDateShort(inv.invoice_date)}</p>
                        </td>
                        <td className="px-4 py-3 sm:px-5">{inv.customer_name}</td>
                        <td className="px-4 py-3 sm:px-5">
                          <Link
                            to={`/sales`}
                            className="text-blue-600 hover:underline"
                          >
                            {inv.order_number}
                          </Link>
                        </td>
                        <td className="px-4 py-3 font-medium sm:px-5">{formatBDT(inv.amount)}</td>
                        <td className="px-4 py-3 sm:px-5">
                          <Badge variant={statusVariant[inv.status]}>{inv.status}</Badge>
                        </td>
                        <td className="px-4 py-3 sm:px-5">
                          <ActionDropdown items={getActions(inv)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 p-4 md:hidden">
                {invoices.map((inv) => (
                  <MobileEntityCard
                    key={inv.id}
                    title={inv.invoice_no}
                    subtitle={formatDateShort(inv.invoice_date)}
                    muted={!!inv.deleted_at}
                    badges={<Badge variant={statusVariant[inv.status]}>{inv.status}</Badge>}
                    rows={[
                      { label: 'Customer', value: inv.customer_name },
                      { label: 'Order', value: inv.order_number },
                      { label: 'Amount', value: formatBDT(inv.amount) },
                    ]}
                    actions={getActions(inv)}
                    onClick={() => setSelected(inv)}
                  />
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <InvoiceDetailsDrawer
        invoice={selected}
        onClose={() => setSelected(null)}
        onMarkPaid={(id) => markPaidMutation.mutate(id)}
        onVoid={(id) => setVoidTarget(invoices?.find((i) => i.id === id) ?? null)}
      />

      <ConfirmDialog
        open={!!voidTarget}
        onOpenChange={() => setVoidTarget(null)}
        title="Void Invoice"
        description={`Void invoice ${voidTarget?.invoice_no}? This cannot be undone.`}
        confirmLabel="Void"
        variant="danger"
        loading={voidMutation.isPending}
        onConfirm={() => voidTarget && voidMutation.mutate(voidTarget.id)}
      />

      <ConfirmDialog
        open={!!archiveTarget}
        onOpenChange={() => setArchiveTarget(null)}
        title="Archive Invoice"
        description={`Archive invoice ${archiveTarget?.invoice_no}?`}
        confirmLabel="Archive"
        variant="danger"
        loading={archiveMutation.isPending}
        onConfirm={() => archiveTarget && archiveMutation.mutate(archiveTarget.id)}
      />
    </PageShell>
  )
}
