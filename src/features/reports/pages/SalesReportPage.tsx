import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-session'
import { reportsRepository } from '../repositories/reports.repository'
import { reportQueryKey } from '../reports.filters'
import { formatBDT } from '@/lib/format'
import { PrintPreviewDialog, ReportPage } from '@/components/reports'
import { ReportKPIGrid } from '../components/ReportKPIGrid'
import { ReportShell, useReportRange } from '../components/ReportShell'

export function SalesReportPage() {
  const { activeBranchId } = useAuth()
  const {
    range,
    setRange,
    filters,
    setFilters,
    applyPreset,
    clearFilters,
    activeCount,
  } = useReportRange()
  const [printOpen, setPrintOpen] = useState(false)

  const queryFilters = useMemo(
    () => ({
      ...range,
      branchId: filters.branchId || activeBranchId || null,
      search: filters.search,
      channel: filters.channel,
      salespersonId: filters.salespersonId,
      customerId: filters.customerId,
    }),
    [range, filters, activeBranchId],
  )

  const { data = [], isLoading, error } = useQuery({
    queryKey: reportQueryKey('sales', queryFilters),
    queryFn: () => reportsRepository.salesReport(queryFilters),
  })

  const summary = useQuery({
    queryKey: reportQueryKey('sales-summary', queryFilters),
    queryFn: () => reportsRepository.salesRegisterSummary(queryFilters),
  })

  const s = summary.data

  const table = (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="border-b bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
          <tr>
            <th className="px-3 py-2 text-left">Invoice</th>
            <th className="px-3 py-2 text-left">Customer</th>
            <th className="px-3 py-2 text-left">Source</th>
            <th className="px-3 py-2 text-right">Gross</th>
            <th className="px-3 py-2 text-right">Discount</th>
            <th className="px-3 py-2 text-right">Net</th>
            <th className="px-3 py-2 text-right">Paid</th>
            <th className="px-3 py-2 text-right">Due</th>
            <th className="px-3 py-2 text-left">Date</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r) => {
            const c = r.customers as unknown as { name: string } | null
            return (
              <tr key={r.id} className="border-b last:border-0">
                <td className="px-3 py-2">
                  <Link
                    className="font-medium underline-offset-2 hover:underline"
                    to={`/sales/${r.id}`}
                  >
                    {r.invoice_no}
                  </Link>
                </td>
                <td className="px-3 py-2">{c?.name || '—'}</td>
                <td className="px-3 py-2 capitalize">
                  {(r.order_source || '—').replace(/_/g, ' ')}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatBDT(Number(r.subtotal ?? r.grand_total))}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatBDT(Number(r.discount ?? 0))}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatBDT(Number(r.grand_total))}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatBDT(Number(r.paid_total))}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatBDT(Number(r.due_total))}
                </td>
                <td className="px-3 py-2">
                  {r.completed_at ? new Date(r.completed_at).toLocaleDateString() : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="px-3 py-2 text-xs text-[#9CA3AF]">{data.length} rows · full-filter set</p>
    </div>
  )

  return (
    <ReportPage>
      <ReportShell
        title="Sales Register"
        subtitle="Completed sales · Paid/Due are document settlement fields. Net sales KPI subtracts posted returns in range (document authority — not identical to P&L timing)."
        range={range}
        onRangeChange={setRange}
        search={filters.search ?? ''}
        onSearchChange={(v) => setFilters({ search: v || null })}
        searchPlaceholder="Invoice, customer, order source…"
        branchId={filters.branchId}
        onBranchChange={(v) => setFilters({ branchId: v })}
        onApplyPreset={applyPreset}
        onClearFilters={clearFilters}
        activeFilterCount={activeCount}
        filtersForMobile={filters}
        onExport={() =>
          reportsRepository.exportReportCsv(
            `sales-${range.from}-${range.to}.csv`,
            ['Invoice', 'Customer', 'Source', 'Subtotal', 'Discount', 'Total', 'Paid', 'Due', 'Completed'],
            data.map((r) => {
              const c = r.customers as unknown as { name: string } | null
              return [
                r.invoice_no,
                c?.name || '',
                r.order_source || '',
                Number(r.subtotal ?? 0),
                Number(r.discount ?? 0),
                Number(r.grand_total),
                Number(r.paid_total),
                Number(r.due_total),
                r.completed_at || '',
              ]
            }),
          )
        }
        onPrint={() => setPrintOpen(true)}
      >
        <ReportKPIGrid
          loading={summary.isLoading}
          items={[
            {
              id: 'gross',
              label: 'Gross sales',
              value: formatBDT(s?.grossSales ?? 0),
              error: summary.isError ? 'Summary failed' : null,
            },
            { id: 'discount', label: 'Total discount', value: formatBDT(s?.totalDiscount ?? 0) },
            { id: 'returns', label: 'Sales returns', value: formatBDT(s?.salesReturns ?? 0) },
            { id: 'net', label: 'Net sales', value: formatBDT(s?.netSales ?? 0) },
            { id: 'txns', label: 'Transactions', value: String(s?.transactions ?? 0) },
            { id: 'paid', label: 'Received amount', value: formatBDT(s?.receivedAmount ?? 0) },
            {
              id: 'due',
              label: 'Outstanding amount',
              value: formatBDT(s?.outstandingAmount ?? 0),
            },
          ]}
        />

        {isLoading ? <p className="text-sm text-[#6B7280]">Loading…</p> : null}
        {error ? <p className="text-sm text-[#E11D48]">Failed to load sales.</p> : null}
        {table}
      </ReportShell>

      <PrintPreviewDialog
        open={printOpen}
        onOpenChange={setPrintOpen}
        title="Sales Register"
        subtitle={`${range.from} → ${range.to}`}
      >
        {table}
      </PrintPreviewDialog>
    </ReportPage>
  )
}
