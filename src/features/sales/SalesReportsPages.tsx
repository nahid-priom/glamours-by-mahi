import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PageShell } from '@/components/layout/PageShell'
import { formatBDT } from '@/lib/format'
import { reportingService } from '@/services/reporting.service'
import { salesService } from '@/services/sales.service'
import { SalesAnalyticsRow } from '@/features/sales/components/SalesAnalyticsRow'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'

/** Live /reports routes only — nested sales report URLs are not registered. */
const SUB_REPORTS = [
  { to: '/reports/sales', label: 'Sales register' },
  { to: '/reports/product-performance', label: 'By Products' },
  { to: '/reports/top-customers', label: 'By Customers' },
  { to: '/sales/collections', label: 'Collections' },
  { to: '/reports/profit', label: 'Profit & Loss' },
  { to: '/reports/salesperson', label: 'Salesperson' },
  { to: '/reports/branch', label: 'By Branch' },
]

export function SalesReportsHubPage() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['reports', 'sales', 'summary'],
    queryFn: () => reportingService.salesSummary(),
  })
  const { data: analytics } = useQuery({
    queryKey: ['reports', 'sales', 'analytics'],
    queryFn: () => salesService.getAnalytics({ days: 30 }),
  })

  return (
    <PageShell title="Sales Reports" description="Performance across channels, products, collections and profit.">
      <div className="flex flex-wrap gap-2">
        {SUB_REPORTS.map((r) => (
          <Link
            key={r.to}
            to={r.to}
            className="rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium hover:border-[#E11D48]/40"
          >
            {r.label}
          </Link>
        ))}
      </div>

      {isLoading || !summary ? (
        <LoadingSkeleton rows={2} height="h-20" />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Gross Sales', summary.grossSales],
            ['Net Sales', summary.netSales],
            ['Gross Profit', summary.grossProfit],
            ['AOV', summary.averageOrderValue],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl border bg-white p-4 shadow-sm">
              <p className="text-[11px] uppercase tracking-wide text-[#6B7280]">{label}</p>
              <p className="mt-1 text-lg font-bold">{formatBDT(Number(value))}</p>
            </div>
          ))}
        </div>
      )}

      {analytics && (
        <SalesAnalyticsRow
          trend={analytics.trend}
          byChannel={analytics.byChannel}
          byPayment={analytics.byPayment}
        />
      )}
    </PageShell>
  )
}

function ReportTable({
  title,
  description,
  headers,
  rows,
}: {
  title: string
  description: string
  headers: string[]
  rows: (string | number)[][]
}) {
  return (
    <PageShell title={title} description={description}>
      <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-[#F8F6F2] text-left text-[11px] uppercase text-[#6B7280]">
            <tr>
              {headers.map((h) => (
                <th key={h} className="px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t">
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-2.5">
                    {typeof cell === 'number' && j > 0 ? formatBDT(cell) : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  )
}

export function SalesReportChannelsPage() {
  const { data = [] } = useQuery({
    queryKey: ['reports', 'sales', 'channels'],
    queryFn: () => reportingService.channelPerformance(),
  })
  return (
    <ReportTable
      title="Sales by Channel"
      description="Revenue and order count by sales channel."
      headers={['Channel', 'Orders', 'Sales']}
      rows={data.map((r) => [r.channel, r.orders, r.sales])}
    />
  )
}

export function SalesReportProductsPage() {
  const { data = [] } = useQuery({
    queryKey: ['reports', 'sales', 'products'],
    queryFn: () => reportingService.productPerformance(),
  })
  return (
    <ReportTable
      title="Sales by Products"
      description="Top products by revenue and profit."
      headers={['Product', 'Qty', 'Revenue', 'Profit']}
      rows={data.slice(0, 50).map((r) => [r.name, r.qty, r.revenue, r.profit])}
    />
  )
}

export function SalesReportCustomersPage() {
  const { data = [] } = useQuery({
    queryKey: ['reports', 'sales', 'customers'],
    queryFn: async () => {
      const sales = salesService.list({})
      const map = new Map<string, { name: string; orders: number; total: number; paid: number; due: number }>()
      for (const s of sales) {
        const row = map.get(s.customerId) ?? {
          name: s.customerName,
          orders: 0,
          total: 0,
          paid: 0,
          due: 0,
        }
        row.orders += 1
        row.total += s.total
        row.paid += s.paidAmount
        row.due += s.dueAmount
        map.set(s.customerId, row)
      }
      return [...map.values()].sort((a, b) => b.total - a.total)
    },
  })
  return (
    <ReportTable
      title="Sales by Customers"
      description="Customer purchase and outstanding due summary."
      headers={['Customer', 'Orders', 'Total', 'Paid', 'Due']}
      rows={data.slice(0, 50).map((r) => [r.name, r.orders, r.total, r.paid, r.due])}
    />
  )
}

export function SalesReportCollectionsPage() {
  const { data = [] } = useQuery({
    queryKey: ['reports', 'sales', 'collections'],
    queryFn: async () => {
      const sales = salesService.list({})
      return sales
        .filter((s) => s.paidAmount > 0)
        .map((s) => [s.saleNo, s.customerName, s.paidAmount, s.paymentMethod, s.created_at.slice(0, 10)])
    },
  })
  return (
    <ReportTable
      title="Collections Report"
      description="Payments collected against sales."
      headers={['Invoice', 'Customer', 'Collected', 'Method', 'Date']}
      rows={data.slice(0, 100) as (string | number)[][]}
    />
  )
}

export function SalesReportProfitPage() {
  const { data: summary } = useQuery({
    queryKey: ['reports', 'sales', 'profit'],
    queryFn: () => reportingService.salesSummary(),
  })
  const { data: products = [] } = useQuery({
    queryKey: ['reports', 'sales', 'profit-products'],
    queryFn: () => reportingService.productPerformance(),
  })
  return (
    <PageShell title="Profit Report" description="Gross profit and margin analysis.">
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Gross Sales', summary.grossSales],
            ['COGS', summary.cogs],
            ['Gross Profit', summary.grossProfit],
            ['Margin %', summary.profitMargin],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl border bg-white p-4">
              <p className="text-[11px] uppercase text-[#6B7280]">{label}</p>
              <p className="mt-1 text-lg font-bold">
                {label === 'Margin %' ? `${value}%` : formatBDT(Number(value))}
              </p>
            </div>
          ))}
        </div>
      )}
      <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-[#F8F6F2] text-left text-[11px] uppercase text-[#6B7280]">
            <tr>
              {['Product', 'Revenue', 'Cost', 'Profit'].map((h) => (
                <th key={h} className="px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.slice(0, 40).map((r) => (
              <tr key={r.productId} className="border-t">
                <td className="px-4 py-2.5">{r.name}</td>
                <td className="px-4 py-2.5">{formatBDT(r.revenue)}</td>
                <td className="px-4 py-2.5">{formatBDT(r.cost)}</td>
                <td className="px-4 py-2.5">{formatBDT(r.profit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  )
}

export function SalesReportReturnsPage() {
  const { data = [] } = useQuery({
    queryKey: ['reports', 'sales', 'returns'],
    queryFn: async () => {
      const { peekDatabase } = await import('@/database/transaction')
      const db = peekDatabase()
      return db.saleReturns.map((r) => {
        const sale = db.sales.find((s) => s.id === r.saleId)
        return [sale?.saleNo ?? r.saleId, r.reason, r.total, r.created_at.slice(0, 10)]
      })
    },
  })
  return (
    <ReportTable
      title="Returns Report"
      description="Returned sales and reasons."
      headers={['Invoice', 'Reason', 'Amount', 'Date']}
      rows={data as (string | number)[][]}
    />
  )
}

export function SalesReportSalespersonPage() {
  const { data } = useQuery({
    queryKey: ['reports', 'sales', 'salesperson'],
    queryFn: () => salesService.getAnalytics(),
  })
  const rows = data?.salespersonPerformance ?? []
  return (
    <ReportTable
      title="Salesperson Performance"
      description="Orders and revenue by salesperson."
      headers={['Salesperson', 'Orders', 'Sales']}
      rows={rows.map((r) => [r.name, r.orders, r.sales])}
    />
  )
}
