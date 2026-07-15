import { useQuery } from '@tanstack/react-query'
import { reportsRepository } from '../repositories/reports.repository'
import { ReportShell, useReportRange } from '../components/ReportShell'
import { formatBDT } from '@/lib/format'

export function PurchasesReportPage() {
  const { range, setRange } = useReportRange()
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['report-purchases', range],
    queryFn: () => reportsRepository.purchasesReport(range),
  })

  return (
    <ReportShell
      title="Purchases report"
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
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
            <tr>
              <th className="px-3 py-2 text-left">Invoice</th>
              <th className="px-3 py-2 text-left">Supplier</th>
              <th className="px-3 py-2 text-left">Total</th>
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
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['report-inventory'],
    queryFn: () => reportsRepository.inventoryReport(),
  })

  return (
    <ReportShell
      title="Inventory report"
      showRange={false}
      onExport={() =>
        reportsRepository.exportReportCsv(
          'inventory.csv',
          ['SKU', 'Product', 'Location', 'Qty'],
          data.map((r) => {
            const v = r.product_variants as unknown as {
              sku: string
              name: string | null
              products: { name: string } | null
            } | null
            const loc = r.stock_locations as unknown as { name: string } | null
            return [v?.sku || '', v?.products?.name || v?.name || '', loc?.name || '', Number(r.quantity)]
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
              <th className="px-3 py-2 text-left">SKU</th>
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-left">Location</th>
              <th className="px-3 py-2 text-left">Qty</th>
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
              return (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-3 py-2">{v?.sku}</td>
                  <td className="px-3 py-2">{v?.products?.name || v?.name}</td>
                  <td className="px-3 py-2">{loc?.name}</td>
                  <td className="px-3 py-2">{Number(r.quantity)}</td>
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
    queryKey: ['report-customer-due'],
    queryFn: () => reportsRepository.customerDueReport(),
  })

  return (
    <ReportShell
      title="Customer due"
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
                <td className="px-3 py-2">{r.name}</td>
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
    queryKey: ['report-supplier-due'],
    queryFn: () => reportsRepository.supplierDueReport(),
  })

  return (
    <ReportShell
      title="Supplier due"
      showRange={false}
      onExport={() =>
        reportsRepository.exportReportCsv(
          'supplier-due.csv',
          ['Name', 'Phone', 'Due'],
          data.map((r) => [r.name, r.phone || '', Number(r.current_due)]),
        )
      }
    >
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
                <td className="px-3 py-2">{r.name}</td>
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
