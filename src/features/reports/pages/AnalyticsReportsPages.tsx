import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { reportsRepository } from '../repositories/reports.repository'
import { ReportShell, useReportRange } from '../components/ReportShell'
import { formatBDT } from '@/lib/format'
import { SimpleProfitLossPage } from '@/features/accounting'

/**
 * Canonical P&L — same authority as `/accounts/profit-loss` (`get_profit_loss_report`).
 * Route is additionally gated by accounts.read | profit_loss.read.
 */
export function ProfitReportPage() {
  return (
    <div className="space-y-2">
      <p className="mx-auto w-full max-w-6xl text-xs text-[#6B7280]">
        Reports P&amp;L uses the same canonical calculation as{' '}
        <Link className="underline" to="/accounts/profit-loss">
          Accounts → Profit &amp; Loss
        </Link>
        . Sales revenue is not cash received.
      </p>
      <SimpleProfitLossPage />
    </div>
  )
}

export function BranchReportPage() {
  const { range, setRange } = useReportRange()
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['reports', 'branch', range],
    queryFn: () => reportsRepository.branchReport(range),
  })

  return (
    <ReportShell
      title="Branch report"
      subtitle="Sales volume by original branch — not branch profit (costs/expenses not allocated here)."
      range={range}
      onRangeChange={setRange}
      onExport={() =>
        reportsRepository.exportReportCsv(
          `branch-${range.from}-${range.to}.csv`,
          ['Branch', 'Sales count', 'Gross sales'],
          data.map((r) => [r.branchName, r.sales, r.total]),
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
                <td className="px-3 py-2">{r.branchName}</td>
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
    queryKey: ['reports', 'salesperson', range],
    queryFn: () => reportsRepository.salespersonReport(range),
  })

  return (
    <ReportShell
      title="Salesperson report"
      subtitle="Attributed sales only — commissions remain under HR/commission policy."
      range={range}
      onRangeChange={setRange}
      onExport={() =>
        reportsRepository.exportReportCsv(
          `salesperson-${range.from}-${range.to}.csv`,
          ['Salesperson', 'Sales count', 'Gross sales'],
          data.map((r) => [r.salespersonName, r.sales, r.total]),
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
                <td className="px-3 py-2">{r.salespersonName}</td>
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
    queryKey: ['reports', 'products', range],
    queryFn: () => reportsRepository.productPerformanceReport(range),
  })

  return (
    <ReportShell
      title="Product performance"
      subtitle="Historical sale_items prices and cost_price snapshots — not today's catalog price."
      range={range}
      onRangeChange={setRange}
      onExport={() =>
        reportsRepository.exportReportCsv(
          `products-${range.from}-${range.to}.csv`,
          ['Product', 'Qty', 'Revenue', 'COGS', 'Gross profit'],
          data.map((r) => [r.label, r.qty, r.revenue, r.cogs, r.grossProfit]),
        )
      }
    >
      {isLoading ? <p className="text-sm text-[#6B7280]">Loading…</p> : null}
      {error ? <p className="text-sm text-[#E11D48]">Failed to load.</p> : null}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
            <tr>
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-left">Qty</th>
              <th className="px-3 py-2 text-left">Revenue</th>
              <th className="px-3 py-2 text-left">COGS</th>
              <th className="px-3 py-2 text-left">Gross</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.variantId} className="border-b last:border-0">
                <td className="px-3 py-2">{r.label}</td>
                <td className="px-3 py-2">{r.qty}</td>
                <td className="px-3 py-2">{formatBDT(r.revenue)}</td>
                <td className="px-3 py-2">{formatBDT(r.cogs)}</td>
                <td className="px-3 py-2">{formatBDT(r.grossProfit)}</td>
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
      <p className="text-xs text-[#6B7280]">
        Courier return requests are operational. They do not automatically change AR, stock, or
        P&amp;L until an authorized sales return is posted.
      </p>
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
