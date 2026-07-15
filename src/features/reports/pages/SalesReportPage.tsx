import { useQuery } from '@tanstack/react-query'
import { reportsRepository } from '../repositories/reports.repository'
import { ReportShell, useReportRange } from '../components/ReportShell'
import { formatBDT } from '@/lib/format'

export function SalesReportPage() {
  const { range, setRange } = useReportRange()
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['report-sales', range],
    queryFn: () => reportsRepository.salesReport(range),
  })

  return (
    <ReportShell
      title="Sales report"
      range={range}
      onRangeChange={setRange}
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
    >
      {isLoading ? <p className="text-sm text-[#6B7280]">Loading…</p> : null}
      {error ? <p className="text-sm text-[#E11D48]">Failed to load.</p> : null}
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
    </ReportShell>
  )
}
