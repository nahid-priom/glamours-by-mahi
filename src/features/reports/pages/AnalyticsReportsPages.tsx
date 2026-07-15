import { useQuery } from '@tanstack/react-query'
import { reportsRepository } from '../repositories/reports.repository'
import { ReportShell, useReportRange } from '../components/ReportShell'
import { formatBDT } from '@/lib/format'

export function ProfitReportPage() {
  const { range, setRange } = useReportRange()
  const { data, isLoading, error } = useQuery({
    queryKey: ['report-profit', range],
    queryFn: () => reportsRepository.profitReport(range),
  })

  return (
    <ReportShell
      title="Profit report"
      range={range}
      onRangeChange={setRange}
      onExport={() =>
        reportsRepository.exportReportCsv(
          `profit-${range.from}-${range.to}.csv`,
          ['Metric', 'Value'],
          data
            ? [
                ['Revenue', data.revenue],
                ['COGS', data.cogs],
                ['Gross profit', data.grossProfit],
                ['Sales count', data.saleCount],
              ]
            : [],
        )
      }
    >
      {isLoading ? <p className="text-sm text-[#6B7280]">Loading…</p> : null}
      {error ? <p className="text-sm text-[#E11D48]">Failed to load.</p> : null}
      {data ? (
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            ['Revenue', data.revenue],
            ['COGS', data.cogs],
            ['Gross profit', data.grossProfit],
            ['Sales', data.saleCount],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border bg-white px-4 py-3">
              <p className="text-xs uppercase text-[#9CA3AF]">{label}</p>
              <p className="text-lg font-bold">
                {typeof value === 'number' && label !== 'Sales' ? formatBDT(value) : value}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </ReportShell>
  )
}

export function BranchReportPage() {
  const { range, setRange } = useReportRange()
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['report-branch', range],
    queryFn: () => reportsRepository.branchReport(range),
  })

  return (
    <ReportShell
      title="Branch report"
      range={range}
      onRangeChange={setRange}
      onExport={() =>
        reportsRepository.exportReportCsv(
          `branch-${range.from}-${range.to}.csv`,
          ['Branch', 'Sales', 'Total'],
          data.map((r) => [r.branchId, r.sales, r.total]),
        )
      }
    >
      {isLoading ? <p className="text-sm text-[#6B7280]">Loading…</p> : null}
      {error ? <p className="text-sm text-[#E11D48]">Failed to load.</p> : null}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
            <tr>
              <th className="px-3 py-2 text-left">Branch</th>
              <th className="px-3 py-2 text-left">Sales</th>
              <th className="px-3 py-2 text-left">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.branchId} className="border-b last:border-0">
                <td className="px-3 py-2 font-mono text-xs">{r.branchId}</td>
                <td className="px-3 py-2">{r.sales}</td>
                <td className="px-3 py-2">{formatBDT(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportShell>
  )
}

export function SalespersonReportPage() {
  const { range, setRange } = useReportRange()
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['report-salesperson', range],
    queryFn: () => reportsRepository.salespersonReport(range),
  })

  return (
    <ReportShell
      title="Salesperson report"
      range={range}
      onRangeChange={setRange}
      onExport={() =>
        reportsRepository.exportReportCsv(
          `salesperson-${range.from}-${range.to}.csv`,
          ['Salesperson', 'Sales', 'Total'],
          data.map((r) => [r.salespersonId, r.sales, r.total]),
        )
      }
    >
      {isLoading ? <p className="text-sm text-[#6B7280]">Loading…</p> : null}
      {error ? <p className="text-sm text-[#E11D48]">Failed to load.</p> : null}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
            <tr>
              <th className="px-3 py-2 text-left">Salesperson</th>
              <th className="px-3 py-2 text-left">Sales</th>
              <th className="px-3 py-2 text-left">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.salespersonId} className="border-b last:border-0">
                <td className="px-3 py-2 font-mono text-xs">{r.salespersonId}</td>
                <td className="px-3 py-2">{r.sales}</td>
                <td className="px-3 py-2">{formatBDT(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportShell>
  )
}

export function ProductPerformanceReportPage() {
  const { range, setRange } = useReportRange()
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['report-products', range],
    queryFn: () => reportsRepository.productPerformanceReport(range),
  })

  return (
    <ReportShell
      title="Product performance"
      range={range}
      onRangeChange={setRange}
      onExport={() =>
        reportsRepository.exportReportCsv(
          `products-${range.from}-${range.to}.csv`,
          ['Product', 'Qty', 'Revenue'],
          data.map((r) => [r.label, r.qty, r.revenue]),
        )
      }
    >
      {isLoading ? <p className="text-sm text-[#6B7280]">Loading…</p> : null}
      {error ? <p className="text-sm text-[#E11D48]">Failed to load.</p> : null}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="border-b bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
            <tr>
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-left">Qty</th>
              <th className="px-3 py-2 text-left">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.variantId} className="border-b last:border-0">
                <td className="px-3 py-2">{r.label}</td>
                <td className="px-3 py-2">{r.qty}</td>
                <td className="px-3 py-2">{formatBDT(r.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportShell>
  )
}

export function CourierReturnsReportPage() {
  const { range, setRange } = useReportRange()
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['report-courier-returns', range],
    queryFn: () => reportsRepository.courierReturnsReport(range),
  })

  return (
    <ReportShell
      title="Courier returns"
      range={range}
      onRangeChange={setRange}
      onExport={() =>
        reportsRepository.exportReportCsv(
          `courier-returns-${range.from}-${range.to}.csv`,
          ['Status', 'Courier', 'Tracking', 'Reason', 'Created'],
          data.map((r) => {
            const c = r.courier_companies as unknown as { name: string } | null
            const p = r.courier_parcels as unknown as { tracking_no: string | null } | null
            return [
              r.status,
              c?.name || '',
              p?.tracking_no || '',
              r.courier_reason || '',
              r.created_at,
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
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Courier</th>
              <th className="px-3 py-2 text-left">Tracking</th>
              <th className="px-3 py-2 text-left">Created</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => {
              const c = r.courier_companies as unknown as { name: string } | null
              const p = r.courier_parcels as unknown as { tracking_no: string | null } | null
              return (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-3 py-2">{r.status}</td>
                  <td className="px-3 py-2">{c?.name || '—'}</td>
                  <td className="px-3 py-2">{p?.tracking_no || '—'}</td>
                  <td className="px-3 py-2">{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </ReportShell>
  )
}
