import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { reportsRepository } from '../repositories/reports.repository'
import { ReportShell, useReportRange } from '../components/ReportShell'
import { formatBDT } from '@/lib/format'
import { financialQueries, financialQueryKeys } from '@/features/accounting/lib/financial-queries'
import { reportQueryKey } from '../reports.filters'
import { useAuth } from '@/features/auth/auth-session'

export function PurchasesReportPage() {
  const { range, setRange } = useReportRange()
  const { data = [], isLoading, error } = useQuery({
    queryKey: reportQueryKey('purchases', range),
    queryFn: () => reportsRepository.purchasesReport(range),
  })

  const totals = data.reduce(
    (acc, r) => {
      acc.total += Number(r.grand_total)
      acc.paid += Number(r.paid_total)
      acc.due += Number(r.due_total)
      return acc
    },
    { total: 0, paid: 0, due: 0 },
  )

  return (
    <ReportShell
      title="Purchases report"
      subtitle="Completed purchase documents. Payments settle AP — they are not a second OpEx line."
      range={range}
      onRangeChange={setRange}
      onExport={() =>
        reportsRepository.exportReportCsv(
          `purchases-${range.from}-${range.to}.csv`,
          ['Invoice', 'Supplier', 'Total', 'Paid', 'Due', 'Completed'],
          data.map((r) => {
            const s = r.suppliers as unknown as { name: string } | null
            return [
              r.invoice_no,
              s?.name || '',
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
      <div className="grid gap-2 sm:grid-cols-3">
        <Kpi label="Purchase total" value={formatBDT(totals.total)} />
        <Kpi label="Paid" value={formatBDT(totals.paid)} />
        <Kpi label="Outstanding on docs" value={formatBDT(totals.due)} />
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
            <tr>
              <th className="px-3 py-2 text-left">Invoice</th>
              <th className="px-3 py-2 text-left">Supplier</th>
              <th className="px-3 py-2 text-left">Total</th>
              <th className="px-3 py-2 text-left">Paid</th>
              <th className="px-3 py-2 text-left">Due</th>
              <th className="px-3 py-2 text-left">Date</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => {
              const s = r.suppliers as unknown as { name: string } | null
              return (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-3 py-2">{r.invoice_no}</td>
                  <td className="px-3 py-2">{s?.name || '—'}</td>
                  <td className="px-3 py-2">{formatBDT(Number(r.grand_total))}</td>
                  <td className="px-3 py-2">{formatBDT(Number(r.paid_total))}</td>
                  <td className="px-3 py-2">{formatBDT(Number(r.due_total))}</td>
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

export function InventoryReportPage() {
  const { can } = useAuth()
  const canSeeCost = can([
    'inventory.valuation',
    'products.manage_prices',
    'accounts.read',
  ])
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['reports', 'inventory'],
    queryFn: () => reportsRepository.inventoryReport(),
  })

  const qtyTotal = data.reduce((s, r) => s + Number(r.quantity), 0)
  const costTotal = canSeeCost
    ? data.reduce(
        (s, r) => s + Number(r.quantity) * Number((r as { average_unit_cost?: number }).average_unit_cost ?? 0),
        0,
      )
    : null

  return (
    <ReportShell
      title="Inventory report"
      subtitle={
        canSeeCost
          ? 'On-hand quantity with WAC cost (average_unit_cost). Selling price is not GL value.'
          : 'On-hand quantity. Cost valuation hidden — requires inventory/accounts cost permission.'
      }
      showRange={false}
      onExport={() =>
        reportsRepository.exportReportCsv(
          'inventory.csv',
          canSeeCost
            ? ['SKU', 'Product', 'Location', 'Qty', 'WAC', 'Cost value']
            : ['SKU', 'Product', 'Location', 'Qty'],
          data.map((r) => {
            const v = r.product_variants as unknown as {
              sku: string
              name: string | null
              products: { name: string } | null
            } | null
            const loc = r.stock_locations as unknown as { name: string } | null
            const wac = Number((r as { average_unit_cost?: number }).average_unit_cost ?? 0)
            const base = [v?.sku || '', v?.products?.name || v?.name || '', loc?.name || '', Number(r.quantity)]
            return canSeeCost ? [...base, wac, Number(r.quantity) * wac] : base
          }),
        )
      }
    >
      {isLoading ? <p className="text-sm text-[#6B7280]">Loading…</p> : null}
      {error ? <p className="text-sm text-[#E11D48]">Failed to load.</p> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <Kpi label="On-hand units (sample ≤500)" value={String(qtyTotal)} />
        {costTotal != null ? <Kpi label="WAC cost value" value={formatBDT(costTotal)} /> : null}
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
            <tr>
              <th className="px-3 py-2 text-left">SKU</th>
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-left">Location</th>
              <th className="px-3 py-2 text-left">Qty</th>
              {canSeeCost ? <th className="px-3 py-2 text-left">WAC</th> : null}
              {canSeeCost ? <th className="px-3 py-2 text-left">Cost</th> : null}
            </tr>
          </thead>
          <tbody>
            {data.map((r) => {
              const v = r.product_variants as unknown as {
                sku: string
                name: string | null
                products: { name: string } | null
              } | null
              const loc = r.stock_locations as unknown as { name: string } | null
              const wac = Number((r as { average_unit_cost?: number }).average_unit_cost ?? 0)
              return (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-3 py-2">{v?.sku}</td>
                  <td className="px-3 py-2">{v?.products?.name || v?.name}</td>
                  <td className="px-3 py-2">{loc?.name}</td>
                  <td className="px-3 py-2">{Number(r.quantity)}</td>
                  {canSeeCost ? <td className="px-3 py-2">{formatBDT(wac)}</td> : null}
                  {canSeeCost ? (
                    <td className="px-3 py-2">{formatBDT(Number(r.quantity) * wac)}</td>
                  ) : null}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </ReportShell>
  )
}

export function CustomerDueReportPage() {
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['reports', 'customer-due'],
    queryFn: () => reportsRepository.customerDueReport(),
  })
  const { data: aging } = useQuery({
    queryKey: financialQueryKeys.dueAging('customer'),
    queryFn: () => financialQueries.getPartyDueAging('customer'),
  })

  return (
    <ReportShell
      title="Customer due"
      subtitle="Authoritative party current_due. Does not mutate balances."
      showRange={false}
      onExport={() =>
        reportsRepository.exportReportCsv(
          'customer-due.csv',
          ['Name', 'Phone', 'Due', 'Spent', 'Paid'],
          data.map((r) => [
            r.name,
            r.phone,
            Number(r.current_due),
            Number(r.total_spent),
            Number(r.total_paid),
          ]),
        )
      }
    >
      {aging ? (
        <div className="grid gap-2 sm:grid-cols-4">
          <Kpi label="Total due" value={formatBDT(aging.totalDue)} />
          <Kpi label="Current" value={formatBDT(aging.current)} />
          <Kpi label="Overdue" value={formatBDT(aging.overdue)} />
          <Kpi label="Undated" value={formatBDT(aging.undated)} />
        </div>
      ) : null}
      <p className="text-xs text-[#6B7280]">
        Full due management:{' '}
        <Link className="underline" to="/accounts/dues?tab=customers">
          Accounts → Dues
        </Link>
      </p>
      {isLoading ? <p className="text-sm text-[#6B7280]">Loading…</p> : null}
      {error ? <p className="text-sm text-[#E11D48]">Failed to load.</p> : null}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="border-b bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
            <tr>
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-left">Phone</th>
              <th className="px-3 py-2 text-left">Due</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="px-3 py-2">
                  <Link className="text-primary underline" to={`/customers/${r.id}`}>
                    {r.name}
                  </Link>
                </td>
                <td className="px-3 py-2">{r.phone}</td>
                <td className="px-3 py-2">{formatBDT(Number(r.current_due))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportShell>
  )
}

export function SupplierDueReportPage() {
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['reports', 'supplier-due'],
    queryFn: () => reportsRepository.supplierDueReport(),
  })
  const { data: aging } = useQuery({
    queryKey: financialQueryKeys.dueAging('supplier'),
    queryFn: () => financialQueries.getPartyDueAging('supplier'),
  })

  return (
    <ReportShell
      title="Supplier due"
      subtitle="Authoritative party current_due. Payments settle AP — not a second purchase expense."
      showRange={false}
      onExport={() =>
        reportsRepository.exportReportCsv(
          'supplier-due.csv',
          ['Name', 'Phone', 'Due'],
          data.map((r) => [r.name, r.phone || '', Number(r.current_due)]),
        )
      }
    >
      {aging ? (
        <div className="grid gap-2 sm:grid-cols-4">
          <Kpi label="Total due" value={formatBDT(aging.totalDue)} />
          <Kpi label="Current" value={formatBDT(aging.current)} />
          <Kpi label="Overdue" value={formatBDT(aging.overdue)} />
          <Kpi label="Undated" value={formatBDT(aging.undated)} />
        </div>
      ) : null}
      <p className="text-xs text-[#6B7280]">
        Full due management:{' '}
        <Link className="underline" to="/accounts/dues?tab=suppliers">
          Accounts → Dues
        </Link>
      </p>
      {isLoading ? <p className="text-sm text-[#6B7280]">Loading…</p> : null}
      {error ? <p className="text-sm text-[#E11D48]">Failed to load.</p> : null}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="border-b bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
            <tr>
              <th className="px-3 py-2 text-left">Supplier</th>
              <th className="px-3 py-2 text-left">Phone</th>
              <th className="px-3 py-2 text-left">Due</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="px-3 py-2">
                  <Link className="text-primary underline" to={`/suppliers/${r.id}`}>
                    {r.name}
                  </Link>
                </td>
                <td className="px-3 py-2">{r.phone || '—'}</td>
                <td className="px-3 py-2">{formatBDT(Number(r.current_due))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportShell>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white px-4 py-3">
      <p className="text-xs uppercase text-[#9CA3AF]">{label}</p>
      <p className="text-lg font-bold tabular-nums">{value}</p>
    </div>
  )
}
