import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportsRepository } from '../repositories/reports.repository'
import { formatBDT } from '@/lib/format'
import {
  ExportActions,
  PrintPreviewDialog,
  ReportFilterBar,
  ReportHeader,
  ReportPage,
  type ReportDateRange,
} from '@/components/reports'

function defaultRange(): ReportDateRange {
  const r = reportsRepository.defaultRange()
  return { from: r.from, to: r.to }
}

export function SalesReportPage() {
  const [range, setRange] = useState(defaultRange)
  const [printOpen, setPrintOpen] = useState(false)

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['report-sales', range],
    queryFn: () => reportsRepository.salesReport(range),
  })

  const totals = useMemo(
    () => ({
      sales: data.reduce((s, r) => s + Number(r.grand_total ?? 0), 0),
      paid: data.reduce((s, r) => s + Number(r.paid_total ?? 0), 0),
      due: data.reduce((s, r) => s + Number(r.due_total ?? 0), 0),
    }),
    [data],
  )

  const table = (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
          <tr>
            <th className="px-3 py-2 text-left">Invoice</th>
            <th className="px-3 py-2 text-left">Customer</th>
            <th className="px-3 py-2 text-left">Total</th>
            <th className="px-3 py-2 text-left">Date</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r) => {
            const c = r.customers as unknown as { name: string } | null
            return (
              <tr key={r.id} className="border-b last:border-0">
                <td className="px-3 py-2">{r.invoice_no}</td>
                <td className="px-3 py-2">{c?.name || '—'}</td>
                <td className="px-3 py-2">{formatBDT(Number(r.grand_total))}</td>
                <td className="px-3 py-2">
                  {r.completed_at ? new Date(r.completed_at).toLocaleDateString() : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  return (
    <ReportPage>
      <ReportHeader
        title="Sales report"
        subtitle={`${data.length} completed sales`}
        actions={
          <ExportActions
            onExport={() =>
              reportsRepository.exportReportCsv(
                `sales-${range.from}-${range.to}.csv`,
                ['Invoice', 'Customer', 'Channel', 'Total', 'Paid', 'Due', 'Completed'],
                data.map((r) => {
                  const c = r.customers as unknown as { name: string } | null
                  return [
                    r.invoice_no,
                    c?.name || '',
                    r.channel || '',
                    Number(r.grand_total),
                    Number(r.paid_total),
                    Number(r.due_total),
                    r.completed_at || '',
                  ]
                }),
              )
            }
            onPrint={() => setPrintOpen(true)}
          />
        }
      />

      <ReportFilterBar range={range} onRangeChange={setRange} />

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total sales', value: formatBDT(totals.sales) },
          { label: 'Collected', value: formatBDT(totals.paid) },
          { label: 'Due', value: formatBDT(totals.due) },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border bg-white px-3 py-3 text-sm">
            <p className="text-[11px] uppercase text-[#6B7280]">{k.label}</p>
            <p className="font-semibold">{k.value}</p>
          </div>
        ))}
      </div>

      {isLoading ? <p className="text-sm text-[#6B7280]">Loading…</p> : null}
      {error ? <p className="text-sm text-[#E11D48]">Failed to load.</p> : null}
      {table}

      <PrintPreviewDialog
        open={printOpen}
        onOpenChange={setPrintOpen}
        title="Sales report"
        subtitle={`${range.from} — ${range.to}`}
      >
        {table}
      </PrintPreviewDialog>
    </ReportPage>
  )
}
