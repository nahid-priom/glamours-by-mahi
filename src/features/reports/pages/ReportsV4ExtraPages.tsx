import { useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-session'
import {
  getInventoryBranchSummary,
  getInventoryValuationSummary,
} from '@/features/inventory/repositories/inventory-valuation.repository'
import { formatBDT } from '@/lib/format'
import { reportQueryKey } from '../reports.filters'
import { ReportShell, useReportRange } from '../components/ReportShell'
import { ReportKPIGrid } from '../components/ReportKPIGrid'
import { reportsRepository } from '../repositories/reports.repository'

export function SalesReturnsReportPage() {
  const { range, setRange, filters, setFilters, applyPreset, clearFilters, activeCount } =
    useReportRange()
  const queryFilters = {
    ...range,
    branchId: filters.branchId,
    status: filters.status,
    search: filters.search,
  }
  const { data = [], isLoading, error } = useQuery({
    queryKey: reportQueryKey('returns', queryFilters),
    queryFn: () => reportsRepository.salesReturnsReport(queryFilters),
  })

  const kpis = useMemo(() => {
    let value = 0
    let qty = 0
    for (const r of data) {
      value += Number(r.total ?? 0)
      const items = (r.sale_return_items ?? []) as unknown as Array<{ qty: number }>
      qty += items.reduce((s, i) => s + Number(i.qty ?? 0), 0)
    }
    return { count: data.length, value, qty }
  }, [data])

  return (
    <ReportShell
      title="Sales Returns & Exchanges"
      subtitle="Posted approved/completed sale returns only — not courier return requests. Line items show variant disposition when available."
      range={range}
      onRangeChange={setRange}
      search={filters.search ?? ''}
      onSearchChange={(v) => setFilters({ search: v || null })}
      searchPlaceholder="Return #, invoice, customer…"
      branchId={filters.branchId}
      onBranchChange={(v) => setFilters({ branchId: v })}
      status={filters.status}
      onStatusChange={(v) => setFilters({ status: v })}
      statusOptions={[
        { value: 'approved', label: 'Approved' },
        { value: 'completed', label: 'Completed' },
      ]}
      onApplyPreset={applyPreset}
      onClearFilters={clearFilters}
      activeFilterCount={activeCount}
      filtersForMobile={filters}
      onExport={() =>
        reportsRepository.exportReportCsv(
          `returns-${range.from}-${range.to}.csv`,
          ['Return #', 'Invoice', 'Customer', 'Status', 'Total', 'Reason', 'Created'],
          data.map((r) => {
            const sale = r.sales as unknown as {
              invoice_no?: string
              customers?: { name?: string } | null
            } | null
            return [
              r.return_no,
              sale?.invoice_no || '',
              sale?.customers?.name || '',
              r.status,
              Number(r.total),
              r.reason || '',
              r.created_at || '',
            ]
          }),
        )
      }
    >
      <ReportKPIGrid
        items={[
          {
            id: 'count',
            label: 'Return transactions',
            value: String(kpis.count),
            hint: 'Approved / completed (or status filter)',
          },
          {
            id: 'qty',
            label: 'Returned quantity',
            value: String(kpis.qty),
          },
          {
            id: 'value',
            label: 'Return value',
            value: formatBDT(kpis.value),
            hint: 'Document return totals',
          },
        ]}
        loading={isLoading}
      />
      {error ? <p className="text-sm text-[#E11D48]">Failed to load returns.</p> : null}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
            <tr>
              <th className="px-3 py-2 text-left">Return</th>
              <th className="px-3 py-2 text-left">Invoice</th>
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-left">Lines</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-left">Date</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => {
              const sale = r.sales as unknown as {
                invoice_no?: string
                customers?: { name?: string } | null
              } | null
              const items = (r.sale_return_items ?? []) as unknown as Array<{
                qty: number
                condition: string
                product_variants?: { sku?: string; name?: string | null; products?: { name?: string } | null } | null
              }>
              const lineSummary = items
                .slice(0, 2)
                .map((i) => {
                  const name =
                    i.product_variants?.products?.name ||
                    i.product_variants?.name ||
                    i.product_variants?.sku ||
                    'Item'
                  return `${name} ×${i.qty} (${i.condition})`
                })
                .join('; ')
              return (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">{r.return_no}</td>
                  <td className="px-3 py-2">{sale?.invoice_no || '—'}</td>
                  <td className="px-3 py-2">{sale?.customers?.name || '—'}</td>
                  <td className="px-3 py-2 text-xs text-[#6B7280]">
                    {lineSummary || '—'}
                    {items.length > 2 ? ` +${items.length - 2}` : ''}
                  </td>
                  <td className="px-3 py-2 capitalize">{r.status}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatBDT(Number(r.total))}
                  </td>
                  <td className="px-3 py-2">
                    {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
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

export function ChannelsReportPage() {
  const { range, setRange, filters, setFilters, applyPreset, clearFilters, activeCount } =
    useReportRange()
  const { activeBranchId } = useAuth()
  const queryFilters = {
    ...range,
    branchId: filters.branchId || activeBranchId || null,
  }
  const { data = [], isLoading, error } = useQuery({
    queryKey: reportQueryKey('channels', queryFilters),
    queryFn: () => reportsRepository.channelPerformanceReport(queryFilters),
  })

  return (
    <ReportShell
      title="Sales Channel Performance"
      subtitle="Attributed by sales.order_source only (authoritative). Free-text channel is not used for totals."
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
          `channels-${range.from}-${range.to}.csv`,
          ['Channel', 'Orders', 'Revenue', 'Due', 'AOV'],
          data.map((r) => [r.channel, r.orders, r.revenue, r.due, r.avgOrderValue]),
        )
      }
    >
      {isLoading ? <p className="text-sm text-[#6B7280]">Loading…</p> : null}
      {error ? <p className="text-sm text-[#E11D48]">Failed to load channels.</p> : null}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
            <tr>
              <th className="px-3 py-2 text-left">Channel</th>
              <th className="px-3 py-2 text-right">Orders</th>
              <th className="px-3 py-2 text-right">Revenue</th>
              <th className="px-3 py-2 text-right">Due</th>
              <th className="px-3 py-2 text-right">AOV</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.channel} className="border-b last:border-0">
                <td className="px-3 py-2 capitalize">{r.channel.replace(/_/g, ' ')}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.orders}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatBDT(r.revenue)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatBDT(r.due)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatBDT(r.avgOrderValue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportShell>
  )
}

export function InventoryValuationReportPage() {
  const { can, activeBranchId } = useAuth()
  const allowed = can(['inventory.valuation', 'products.manage_prices', 'accounts.read'])

  const summary = useQuery({
    queryKey: ['reports', 'inventory-valuation', activeBranchId],
    enabled: allowed,
    queryFn: () =>
      getInventoryValuationSummary({ branchId: activeBranchId ?? undefined }),
  })

  const branches = useQuery({
    queryKey: ['reports', 'inventory-valuation-branches'],
    enabled: allowed,
    queryFn: () => getInventoryBranchSummary(false),
  })

  if (!allowed) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        Inventory valuation requires inventory valuation, price management, or accounts read
        permission.
      </div>
    )
  }

  const cost = summary.data?.total_stock_purchase_cost
  const sell = summary.data?.total_stock_value

  return (
    <ReportShell
      title="Inventory Valuation"
      subtitle="Authoritative as-of valuation. WAC / purchase cost is the financial stock value; sell value is catalog × qty."
      showRange={false}
      onExport={() =>
        reportsRepository.exportReportCsv(
          `inventory-valuation.csv`,
          ['Branch', 'Variants', 'Qty', 'WAC cost', 'Sell value'],
          (branches.data ?? []).map((b) => [
            b.branch_name,
            b.total_variants,
            b.total_stock_quantity,
            b.total_stock_purchase_cost ?? '',
            b.total_stock_value,
          ]),
        )
      }
    >
      <ReportKPIGrid
        loading={summary.isLoading}
        items={[
          {
            id: 'wac',
            label: 'WAC / purchase cost',
            value: cost == null ? 'Restricted' : formatBDT(Number(cost)),
            hint: 'As-of inventory cost authority',
            error: summary.isError ? 'Valuation failed' : null,
          },
          {
            id: 'sell',
            label: 'Sell value',
            value: formatBDT(Number(sell ?? 0)),
            hint: 'Catalog sell × qty (not GL WAC)',
          },
          {
            id: 'qty',
            label: 'Total quantity',
            value: String(summary.data?.total_stock_quantity ?? 0),
            hint: 'On-hand units',
          },
          {
            id: 'variants',
            label: 'Variants in stock',
            value: String(summary.data?.total_variants ?? 0),
          },
        ]}
      />
      {branches.isError ? (
        <p className="text-sm text-[#E11D48]">Could not load branch valuation.</p>
      ) : null}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
            <tr>
              <th className="px-3 py-2 text-left">Branch</th>
              <th className="px-3 py-2 text-right">Variants</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">WAC cost</th>
              <th className="px-3 py-2 text-right">Sell value</th>
            </tr>
          </thead>
          <tbody>
            {(branches.data ?? []).map((b) => (
              <tr key={b.branch_id} className="border-b last:border-0">
                <td className="px-3 py-2">{b.branch_name}</td>
                <td className="px-3 py-2 text-right tabular-nums">{b.total_variants}</td>
                <td className="px-3 py-2 text-right tabular-nums">{b.total_stock_quantity}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {b.total_stock_purchase_cost == null
                    ? '—'
                    : formatBDT(b.total_stock_purchase_cost)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatBDT(b.total_stock_value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportShell>
  )
}

export function CodSettlementReportPage() {
  const { range, setRange, filters, setFilters, applyPreset, clearFilters, activeCount } =
    useReportRange()
  const queryFilters = { ...range, status: filters.status }
  const { data = [], isLoading, error } = useQuery({
    queryKey: reportQueryKey('cod-settlement', queryFilters),
    queryFn: () => reportsRepository.codSettlementReport(queryFilters),
  })

  const kpis = useMemo(() => {
    const expected = data.reduce((s, r) => s + Number(r.cod_amount ?? 0), 0)
    const charges = data.reduce((s, r) => s + Number(r.courier_charge ?? 0), 0)
    const settlement = data.reduce((s, r) => s + Number(r.settlement_amount ?? 0), 0)
    const settled = data
      .filter((r) => r.status === 'settled')
      .reduce((s, r) => s + Number(r.settlement_amount ?? 0), 0)
    const pending = data.filter((r) => r.status === 'pending').length
    const pendingCod = data
      .filter((r) => r.status === 'pending')
      .reduce((s, r) => s + Number(r.cod_amount ?? 0), 0)
    return { expected, charges, settlement, settled, pending, pendingCod }
  }, [data])

  return (
    <ReportShell
      title="COD Settlement"
      subtitle="Courier settlement documents — delivered parcels are not automatically settled."
      range={range}
      onRangeChange={setRange}
      status={filters.status}
      onStatusChange={(v) => setFilters({ status: v })}
      statusOptions={[
        { value: 'pending', label: 'Pending' },
        { value: 'settled', label: 'Settled' },
        { value: 'cancelled', label: 'Cancelled' },
      ]}
      onApplyPreset={applyPreset}
      onClearFilters={clearFilters}
      activeFilterCount={activeCount}
      filtersForMobile={filters}
      onExport={() =>
        reportsRepository.exportReportCsv(
          `cod-settlement-${range.from}-${range.to}.csv`,
          ['Courier', 'Tracking', 'COD', 'Charge', 'Settlement', 'Status', 'Date'],
          data.map((r) => {
            const company = r.courier_companies as unknown as { name?: string } | null
            const parcel = r.courier_parcels as unknown as { tracking_no?: string } | null
            return [
              company?.name || '',
              parcel?.tracking_no || '',
              Number(r.cod_amount),
              Number(r.courier_charge),
              Number(r.settlement_amount),
              r.status,
              r.settlement_date || r.created_at || '',
            ]
          }),
        )
      }
    >
      <ReportKPIGrid
        loading={isLoading}
        items={[
          { id: 'expected', label: 'Expected COD', value: formatBDT(kpis.expected) },
          { id: 'charges', label: 'Courier charges', value: formatBDT(kpis.charges) },
          { id: 'settled', label: 'Settled amount', value: formatBDT(kpis.settled) },
          {
            id: 'pending',
            label: 'Outstanding settlement',
            value: formatBDT(kpis.pendingCod),
            hint: `${kpis.pending} pending docs`,
          },
        ]}
      />
      {error ? <p className="text-sm text-[#E11D48]">Failed to load settlements.</p> : null}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
            <tr>
              <th className="px-3 py-2 text-left">Courier</th>
              <th className="px-3 py-2 text-left">Tracking</th>
              <th className="px-3 py-2 text-right">COD</th>
              <th className="px-3 py-2 text-right">Charge</th>
              <th className="px-3 py-2 text-right">Settlement</th>
              <th className="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => {
              const company = r.courier_companies as unknown as { name?: string } | null
              const parcel = r.courier_parcels as unknown as { tracking_no?: string } | null
              return (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-3 py-2">{company?.name || '—'}</td>
                  <td className="px-3 py-2">{parcel?.tracking_no || '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatBDT(Number(r.cod_amount))}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatBDT(Number(r.courier_charge))}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatBDT(Number(r.settlement_amount))}
                  </td>
                  <td className="px-3 py-2 capitalize">{r.status}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </ReportShell>
  )
}

/** Alias → product performance in variant aggregation mode. */
export function VariantPerformanceReportPage() {
  return <Navigate to="/reports/product-performance?level=variant" replace />
}
