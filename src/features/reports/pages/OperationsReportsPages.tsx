import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { reportsRepository } from '../repositories/reports.repository'
import { ReportShell, useReportRange } from '../components/ReportShell'
import { ReportKPIGrid } from '../components/ReportKPIGrid'
import { formatBDT } from '@/lib/format'
import { financialQueries, financialQueryKeys } from '@/features/accounting/lib/financial-queries'
import { reportQueryKey } from '../reports.filters'
import { useAuth } from '@/features/auth/auth-session'

export function PurchasesReportPage() {
  const { range, setRange, filters, setFilters, applyPreset, clearFilters, activeCount } =
    useReportRange()

  const queryFilters = {
    ...range,
    branchId: filters.branchId,
    supplierId: filters.supplierId,
    search: filters.search,
  }

  const { data = [], isLoading, error } = useQuery({
    queryKey: reportQueryKey('purchases', queryFilters),
    queryFn: () => reportsRepository.purchasesReport(queryFilters),
  })

  const summary = useQuery({
    queryKey: reportQueryKey('purchases-summary', queryFilters),
    queryFn: () => reportsRepository.purchasesRegisterSummary(queryFilters),
  })

  const s = summary.data

  return (
    <ReportShell
      title="Purchase Register"
      subtitle="Completed purchase documents. Payments settle AP — they are not a second OpEx line."
      range={range}
      onRangeChange={setRange}
      search={filters.search ?? ''}
      onSearchChange={(v) => setFilters({ search: v || null })}
      searchPlaceholder="Invoice or supplier…"
      branchId={filters.branchId}
      onBranchChange={(v) => setFilters({ branchId: v })}
      onApplyPreset={applyPreset}
      onClearFilters={clearFilters}
      activeFilterCount={activeCount}
      filtersForMobile={filters}
      onExport={() =>
        reportsRepository.exportReportCsv(
          `purchases-${range.from}-${range.to}.csv`,
          ['Invoice', 'Supplier', 'Total', 'Paid', 'Due', 'Completed'],
          data.map((r) => {
            const sRow = r.suppliers as unknown as { name: string } | null
            return [
              r.invoice_no,
              sRow?.name || '',
              Number(r.grand_total),
              Number(r.paid_total),
              Number(r.due_total),
              r.completed_at || '',
            ]
          }),
        )
      }
    >
      <ReportKPIGrid
        loading={summary.isLoading}
        items={[
          {
            id: 'gross',
            label: 'Gross purchases',
            value: formatBDT(s?.grossPurchases ?? 0),
            error: summary.isError ? 'Summary failed' : null,
          },
          { id: 'disc', label: 'Purchase discount', value: formatBDT(s?.purchaseDiscount ?? 0) },
          { id: 'net', label: 'Net purchases', value: formatBDT(s?.netPurchases ?? 0) },
          { id: 'paid', label: 'Supplier payments', value: formatBDT(s?.paidAmount ?? 0) },
          {
            id: 'due',
            label: 'Outstanding on docs',
            value: formatBDT(s?.outstandingAmount ?? 0),
          },
        ]}
      />
      {isLoading ? <p className="text-sm text-[#6B7280]">Loading…</p> : null}
      {error ? <p className="text-sm text-[#E11D48]">Failed to load.</p> : null}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
            <tr>
              <th className="px-3 py-2 text-left">Invoice</th>
              <th className="px-3 py-2 text-left">Supplier</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">Paid</th>
              <th className="px-3 py-2 text-right">Due</th>
              <th className="px-3 py-2 text-left">Date</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => {
              const sRow = r.suppliers as unknown as { name: string } | null
              return (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-3 py-2">{r.invoice_no}</td>
                  <td className="px-3 py-2">{sRow?.name || '—'}</td>
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
      </div>
    </ReportShell>
  )
}

export function InventoryReportPage() {
  const { can, activeBranchId } = useAuth()
  const canSeeCost = can(['inventory.valuation', 'products.manage_prices', 'accounts.read'])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [branchId, setBranchId] = useState<string | null>(activeBranchId)

  const { data, isLoading, error } = useQuery({
    queryKey: ['reports', 'inventory', branchId, search, page],
    queryFn: () =>
      reportsRepository.inventoryReport({
        branchId,
        search: search || null,
        page,
        pageSize: 50,
      }),
  })

  const rows = data?.rows ?? []

  return (
    <ReportShell
      title="Stock Balance"
      subtitle={
        canSeeCost
          ? 'On-hand quantity with WAC cost (average_unit_cost). Totals span all matching rows, not only this page.'
          : 'On-hand quantity. Cost valuation hidden — requires inventory/accounts cost permission.'
      }
      showRange={false}
      onExport={() =>
        reportsRepository.exportReportCsv(
          'inventory.csv',
          canSeeCost
            ? ['SKU', 'Product', 'Variant', 'Location', 'Qty', 'WAC', 'Cost value']
            : ['SKU', 'Product', 'Variant', 'Location', 'Qty'],
          rows.map((r) => {
            const v = r.product_variants as unknown as {
              sku: string
              name: string | null
              products: { name: string } | null
            } | null
            const loc = r.stock_locations as unknown as { name: string } | null
            const wac = Number(r.average_unit_cost ?? 0)
            const base = [
              v?.sku || '',
              v?.products?.name || '',
              v?.name || '',
              loc?.name || '',
              Number(r.quantity),
            ]
            return canSeeCost ? [...base, wac, Number(r.quantity) * wac] : base
          }),
        )
      }
    >
      <div className="flex flex-wrap gap-2">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          placeholder="Search SKU or product…"
          className="max-w-xs"
        />
        <Input
          value={branchId ?? ''}
          onChange={(e) => {
            setBranchId(e.target.value || null)
            setPage(1)
          }}
          placeholder="Branch ID (optional)"
          className="max-w-[14rem]"
        />
      </div>
      <ReportKPIGrid
        loading={isLoading}
        items={[
          {
            id: 'qty',
            label: 'On-hand units (all matching)',
            value: String(data?.qtyTotal ?? 0),
            hint: `${data?.totalCount ?? 0} balance rows`,
            error: error ? 'Failed to load' : null,
          },
          ...(canSeeCost
            ? [
                {
                  id: 'cost',
                  label: 'WAC cost value',
                  value: formatBDT(data?.costTotal ?? 0),
                  hint: 'qty × average_unit_cost',
                },
              ]
            : []),
        ]}
      />
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
            <tr>
              <th className="px-3 py-2 text-left">SKU</th>
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-left">Variant</th>
              <th className="px-3 py-2 text-left">Location</th>
              <th className="px-3 py-2 text-right">Qty</th>
              {canSeeCost ? <th className="px-3 py-2 text-right">WAC</th> : null}
              {canSeeCost ? <th className="px-3 py-2 text-right">Cost</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const v = r.product_variants as unknown as {
                sku: string
                name: string | null
                products: { name: string } | null
              } | null
              const loc = r.stock_locations as unknown as { name: string } | null
              const wac = Number(r.average_unit_cost ?? 0)
              return (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">{v?.sku}</td>
                  <td className="px-3 py-2">{v?.products?.name || '—'}</td>
                  <td className="px-3 py-2">{v?.name || '—'}</td>
                  <td className="px-3 py-2">{loc?.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{Number(r.quantity)}</td>
                  {canSeeCost ? (
                    <td className="px-3 py-2 text-right tabular-nums">{formatBDT(wac)}</td>
                  ) : null}
                  {canSeeCost ? (
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatBDT(Number(r.quantity) * wac)}
                    </td>
                  ) : null}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Previous
        </Button>
        <span className="text-xs text-[#6B7280]">
          Page {data?.page ?? page} · {data?.pageSize ?? 50}/page
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={(data?.rows.length ?? 0) < (data?.pageSize ?? 50)}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>
    </ReportShell>
  )
}

export function CustomerDueReportPage() {
  const [search, setSearch] = useState('')
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['reports', 'customer-due', search],
    queryFn: () => reportsRepository.customerDueReport(search),
  })
  const aging = useQuery({
    queryKey: financialQueryKeys.dueAging('customer'),
    queryFn: () => financialQueries.getPartyDueAging('customer'),
  })

  return (
    <ReportShell
      title="Customer Receivables"
      subtitle="Party current_due list. Aging KPIs come from get_party_due_aging (invoice due dates) and may differ from the party total."
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
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search customer…"
        className="max-w-md"
      />
      <ReportKPIGrid
        loading={aging.isLoading}
        items={[
          {
            id: 'aging-total',
            label: 'Aging total due',
            value: formatBDT(aging.data?.totalDue ?? 0),
            hint: 'Invoice aging RPC',
            error: aging.isError ? 'Aging failed' : null,
          },
          { id: 'current', label: 'Not yet overdue', value: formatBDT(aging.data?.current ?? 0) },
          { id: 'overdue', label: 'Overdue', value: formatBDT(aging.data?.overdue ?? 0) },
          { id: 'undated', label: 'Undated', value: formatBDT(aging.data?.undated ?? 0) },
        ]}
      />
      <p className="text-xs text-[#6B7280]">
        Party list total below is current_due · Full due management:{' '}
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
              <th className="px-3 py-2 text-right">Due</th>
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
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatBDT(Number(r.current_due))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportShell>
  )
}

export function SupplierDueReportPage() {
  const [search, setSearch] = useState('')
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['reports', 'supplier-due', search],
    queryFn: () => reportsRepository.supplierDueReport(search),
  })
  const aging = useQuery({
    queryKey: financialQueryKeys.dueAging('supplier'),
    queryFn: () => financialQueries.getPartyDueAging('supplier'),
  })

  return (
    <ReportShell
      title="Supplier Payables"
      subtitle="Party current_due list. Aging KPIs from get_party_due_aging may differ from party totals."
      showRange={false}
      onExport={() =>
        reportsRepository.exportReportCsv(
          'supplier-due.csv',
          ['Name', 'Phone', 'Due'],
          data.map((r) => [r.name, r.phone || '', Number(r.current_due)]),
        )
      }
    >
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search supplier…"
        className="max-w-md"
      />
      <ReportKPIGrid
        loading={aging.isLoading}
        items={[
          {
            id: 'aging-total',
            label: 'Aging total due',
            value: formatBDT(aging.data?.totalDue ?? 0),
            hint: 'Invoice aging RPC',
            error: aging.isError ? 'Aging failed' : null,
          },
          { id: 'current', label: 'Not yet overdue', value: formatBDT(aging.data?.current ?? 0) },
          { id: 'overdue', label: 'Overdue', value: formatBDT(aging.data?.overdue ?? 0) },
          { id: 'undated', label: 'Undated', value: formatBDT(aging.data?.undated ?? 0) },
        ]}
      />
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
              <th className="px-3 py-2 text-right">Due</th>
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
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatBDT(Number(r.current_due))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportShell>
  )
}
