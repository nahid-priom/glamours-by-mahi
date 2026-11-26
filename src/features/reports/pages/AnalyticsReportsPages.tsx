import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/auth-session'
import { SimpleProfitLossPage } from '@/features/accounting'
import { formatBDT } from '@/lib/format'
import { reportsRepository } from '../repositories/reports.repository'
import { reportQueryKey } from '../reports.filters'
import { ReportShell, useReportRange } from '../components/ReportShell'
import { ReportKPIGrid } from '../components/ReportKPIGrid'

/**
 * Canonical P&L — same authority as `/accounts/profit-loss` (`get_profit_loss_report`).
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
  const { range, setRange, filters, applyPreset, clearFilters, activeCount } = useReportRange()
  const queryFilters = { ...range, branchId: filters.branchId }
  const { data = [], isLoading, error } = useQuery({
    queryKey: reportQueryKey('branch', queryFilters),
    queryFn: () => reportsRepository.branchReport(queryFilters),
  })

  return (
    <ReportShell
      title="Branch Performance"
      subtitle="Sales volume by original branch attribution — not branch P&amp;L. Unassigned sales are included."
      range={range}
      onRangeChange={setRange}
      onApplyPreset={applyPreset}
      onClearFilters={clearFilters}
      activeFilterCount={activeCount}
      filtersForMobile={filters}
      onExport={() =>
        reportsRepository.exportReportCsv(
          `branch-${range.from}-${range.to}.csv`,
          ['Branch', 'Sales count', 'Gross sales', 'Discount', 'Due', 'Contribution %', 'ATV'],
          data.map((r) => [
            r.branchName,
            r.sales,
            r.total,
            r.discount,
            r.due,
            r.contributionPct.toFixed(1),
            r.avgTransaction,
          ]),
        )
      }
    >
      {isLoading ? <p className="text-sm text-[#6B7280]">Loading…</p> : null}
      {error ? <p className="text-sm text-[#E11D48]">Failed to load.</p> : null}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
            <tr>
              <th className="px-3 py-2 text-left">Branch</th>
              <th className="px-3 py-2 text-right">Sales</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">Share</th>
              <th className="px-3 py-2 text-right">ATV</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.branchId} className="border-b last:border-0">
                <td className="px-3 py-2">{r.branchName}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.sales}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatBDT(r.total)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.contributionPct.toFixed(1)}%
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatBDT(r.avgTransaction)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportShell>
  )
}

export function SalespersonReportPage() {
  const { range, setRange, filters, applyPreset, clearFilters, activeCount } = useReportRange()
  const queryFilters = { ...range, branchId: filters.branchId }
  const { data = [], isLoading, error } = useQuery({
    queryKey: reportQueryKey('salesperson', queryFilters),
    queryFn: () => reportsRepository.salespersonReport(queryFilters),
  })

  return (
    <ReportShell
      title="Salesperson Performance"
      subtitle="Attributed sales only — unassigned bucket included. Commissions remain under HR policy."
      range={range}
      onRangeChange={setRange}
      onApplyPreset={applyPreset}
      onClearFilters={clearFilters}
      activeFilterCount={activeCount}
      filtersForMobile={filters}
      onExport={() =>
        reportsRepository.exportReportCsv(
          `salesperson-${range.from}-${range.to}.csv`,
          ['Salesperson', 'Sales count', 'Gross sales', 'Due', 'ATV'],
          data.map((r) => [r.salespersonName, r.sales, r.total, r.due, r.avgTransaction]),
        )
      }
    >
      {isLoading ? <p className="text-sm text-[#6B7280]">Loading…</p> : null}
      {error ? <p className="text-sm text-[#E11D48]">Failed to load.</p> : null}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-b bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
            <tr>
              <th className="px-3 py-2 text-left">Salesperson</th>
              <th className="px-3 py-2 text-right">Sales</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">ATV</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.salespersonId} className="border-b last:border-0">
                <td className="px-3 py-2">{r.salespersonName}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.sales}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatBDT(r.total)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatBDT(r.avgTransaction)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportShell>
  )
}

export function ProductPerformanceReportPage() {
  const { range, setRange, filters, setFilters, applyPreset, clearFilters, activeCount } =
    useReportRange()
  const [params, setParams] = useSearchParams()
  const level = params.get('level') === 'product' ? 'product' : 'variant'
  const { can, activeBranchId } = useAuth()
  const showCost = can([
    'inventory.valuation',
    'products.manage_prices',
    'accounts.read',
    'profit_loss.read',
  ])

  const queryFilters = {
    ...range,
    branchId: filters.branchId || activeBranchId || null,
  }

  const { data = [], isLoading, error } = useQuery({
    queryKey: reportQueryKey('products', { ...queryFilters, level }),
    queryFn: () => reportsRepository.productPerformanceReport(queryFilters, level),
  })

  const totals = useMemo(() => {
    const revenue = data.reduce((s, r) => s + r.netRevenue, 0)
    const cogs = data.reduce((s, r) => s + r.netCogs, 0)
    const qty = data.reduce((s, r) => s + r.netQty, 0)
    const returnedQty = data.reduce((s, r) => s + r.returnedQty, 0)
    const grossProfit = revenue - cogs
    return {
      qty,
      returnedQty,
      revenue,
      cogs,
      grossProfit,
      marginPct: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
    }
  }, [data])

  return (
    <ReportShell
      title="Product Performance"
      subtitle="Historical sale_items cost_price snapshots with posted-return netting. Margin is weighted (not average of row %). Variant name carries size/color when configured on the SKU."
      range={range}
      onRangeChange={setRange}
      branchId={filters.branchId}
      onBranchChange={(v) => setFilters({ branchId: v })}
      onApplyPreset={applyPreset}
      onClearFilters={clearFilters}
      activeFilterCount={activeCount}
      filtersForMobile={filters}
      onExport={() =>
        reportsRepository.exportReportCsv(
          `products-${level}-${range.from}-${range.to}.csv`,
          showCost
            ? [
                'Label',
                'SKU',
                'Variant',
                'Sold',
                'Returned',
                'Net qty',
                'Net revenue',
                'Net COGS',
                'Gross profit',
                'Margin %',
              ]
            : ['Label', 'SKU', 'Variant', 'Sold', 'Returned', 'Net qty', 'Net revenue'],
          data.map((r) =>
            showCost
              ? [
                  r.label,
                  r.sku,
                  r.variantName,
                  r.qty,
                  r.returnedQty,
                  r.netQty,
                  r.netRevenue,
                  r.netCogs,
                  r.grossProfit,
                  r.marginPct.toFixed(1),
                ]
              : [r.label, r.sku, r.variantName, r.qty, r.returnedQty, r.netQty, r.netRevenue],
          ),
        )
      }
    >
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
            level === 'variant' ? 'border-primary bg-primary text-white' : 'border-border bg-white'
          }`}
          onClick={() => {
            const next = new URLSearchParams(params)
            next.set('level', 'variant')
            setParams(next, { replace: true })
          }}
        >
          By variant / SKU
        </button>
        <button
          type="button"
          className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
            level === 'product' ? 'border-primary bg-primary text-white' : 'border-border bg-white'
          }`}
          onClick={() => {
            const next = new URLSearchParams(params)
            next.set('level', 'product')
            setParams(next, { replace: true })
          }}
        >
          By product
        </button>
      </div>
      <ReportKPIGrid
        loading={isLoading}
        items={[
          { id: 'sold', label: 'Units sold', value: String(totals.qty) },
          { id: 'ret', label: 'Returned units', value: String(totals.returnedQty) },
          { id: 'netqty', label: 'Net sold qty', value: String(totals.qty - totals.returnedQty) },
          { id: 'rev', label: 'Net revenue', value: formatBDT(totals.revenue) },
          ...(showCost
            ? [
                { id: 'cogs', label: 'Net COGS', value: formatBDT(totals.cogs) },
                {
                  id: 'gp',
                  label: 'Gross profit / margin',
                  value: `${formatBDT(totals.grossProfit)} · ${totals.marginPct.toFixed(1)}%`,
                },
              ]
            : []),
        ]}
      />
      {error ? <p className="text-sm text-[#E11D48]">Failed to load.</p> : null}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
            <tr>
              <th className="px-3 py-2 text-left">{level === 'product' ? 'Product' : 'Variant'}</th>
              <th className="px-3 py-2 text-left">SKU</th>
              <th className="px-3 py-2 text-right">Sold</th>
              <th className="px-3 py-2 text-right">Returned</th>
              <th className="px-3 py-2 text-right">Net qty</th>
              <th className="px-3 py-2 text-right">Revenue</th>
              {showCost ? (
                <>
                  <th className="px-3 py-2 text-right">COGS</th>
                  <th className="px-3 py-2 text-right">Gross</th>
                  <th className="px-3 py-2 text-right">Margin</th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.variantId} className="border-b last:border-0">
                <td className="px-3 py-2">{r.label}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.sku || '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.qty}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.returnedQty}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.netQty}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatBDT(r.netRevenue)}</td>
                {showCost ? (
                  <>
                    <td className="px-3 py-2 text-right tabular-nums">{formatBDT(r.netCogs)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatBDT(r.grossProfit)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.marginPct.toFixed(1)}%
                    </td>
                  </>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportShell>
  )
}

export function CourierReturnsReportPage() {
  const { range, setRange, filters, setFilters, applyPreset, clearFilters, activeCount } =
    useReportRange()
  const queryFilters = { ...range, status: filters.status }
  const { data = [], isLoading, error } = useQuery({
    queryKey: reportQueryKey('courier-returns', queryFilters),
    queryFn: () => reportsRepository.courierReturnsReport(queryFilters),
  })

  return (
    <ReportShell
      title="Courier Returns"
      subtitle="Operational courier return requests — not posted sale returns. They do not change AR, stock, or P&amp;L until an authorized sales return is posted."
      range={range}
      onRangeChange={setRange}
      status={filters.status}
      onStatusChange={(v) => setFilters({ status: v })}
      statusOptions={[
        { value: 'pending', label: 'Pending' },
        { value: 'approved', label: 'Approved' },
        { value: 'rejected', label: 'Rejected' },
        { value: 'completed', label: 'Completed' },
      ]}
      onApplyPreset={applyPreset}
      onClearFilters={clearFilters}
      activeFilterCount={activeCount}
      filtersForMobile={filters}
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
                  <td className="px-3 py-2 capitalize">{r.status}</td>
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
