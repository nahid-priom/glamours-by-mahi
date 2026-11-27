import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { financialQueries, financialQueryKeys } from '../../lib/financial-queries'
import { PageHeader, DateRangeInputs, ErrorText, KpiCard, DataTable } from '../../components/AccountingUi'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CashFlowChart } from '@/features/dashboard/components/CashFlowChart'
import { useAuth } from '@/features/auth/auth-session'
import { addDaysYmd, resolveShortcut, todayYmd } from '@/lib/datetime/bd'
import { formatBDT } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useReportFilters } from '@/features/reports/hooks/use-report-filters'

type Tab = 'overview' | 'branch' | 'product' | 'sale' | 'statement'

function presetRange(kind: 'today' | 'yesterday' | 'week' | 'month') {
  if (kind === 'today') return resolveShortcut('today')
  if (kind === 'week') return resolveShortcut('this_week')
  if (kind === 'month') return resolveShortcut('this_month')
  const d = addDaysYmd(todayYmd(), -1)
  return { from: d, to: d }
}

export function SimpleProfitLossPage() {
  const { activeBranchId } = useAuth()
  const { range, setFilters } = useReportFilters()
  const setRange = (next: { from: string; to: string }) => setFilters(next)
  const [tab, setTab] = useState<Tab>('overview')

  const { data, isLoading, error } = useQuery({
    queryKey: financialQueryKeys.profitLossReport(range.from, range.to, activeBranchId),
    queryFn: () => financialQueries.getProfitLossReport(range.from, range.to, activeBranchId),
  })

  const chartData = useMemo(() => data?.trend ?? [], [data?.trend])

  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 space-y-4">
      <PageHeader
        title="Profit & Loss"
        subtitle="Snapshot COGS from sale lines. Deposits and withdrawals are cash moves — not other income or expense."
      />
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['today', 'Today'],
            ['yesterday', 'Yesterday'],
            ['week', 'This week'],
            ['month', 'This month'],
          ] as const
        ).map(([key, label]) => (
          <Button key={key} size="sm" variant="outline" onClick={() => setRange(presetRange(key))}>
            {label}
          </Button>
        ))}
      </div>
      <DateRangeInputs from={range.from} to={range.to} onChange={setRange} />

      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-white p-1 text-sm">
        {(
          [
            ['overview', 'Overview'],
            ['branch', 'Branch Wise'],
            ['product', 'Product Wise'],
            ['sale', 'Sale Wise'],
            ['statement', 'Overall P&L'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={cn(
              'rounded-md px-3 py-1.5 font-medium',
              tab === id ? 'bg-[#111827] text-white' : 'text-[#6B7280]',
            )}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : null}
      <ErrorText error={error} />

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard label="Net sales" value={formatBDT(data.netSales)} hint="Sales minus returns" />
            <KpiCard label="Product cost (COGS)" value={formatBDT(data.productCost)} hint="Snapshot cost_price" />
            <KpiCard
              label="Gross profit"
              value={formatBDT(data.grossProfit)}
              hint="Net sales − product cost"
            />
            <KpiCard
              label="Gross margin"
              value={`${data.grossMarginPct.toFixed(1)}%`}
              hint="Gross profit ÷ net sales"
            />
            <KpiCard label="Other income" value={formatBDT(data.otherIncome)} hint="Excludes deposits" />
            <KpiCard label="Expenses" value={formatBDT(data.expenses)} hint="Excludes withdrawals" />
            <KpiCard
              label="Net profit"
              value={formatBDT(data.netProfit)}
              hint="Gross + other income − expenses"
            />
            <KpiCard
              label="Net profit margin"
              value={`${data.netProfitMarginPct.toFixed(1)}%`}
              hint="Net profit ÷ net sales"
            />
          </div>

          {tab === 'overview' ? (
            <div className="space-y-4">
              {chartData.length > 0 ? (
                <>
                  <p className="text-xs text-[#6B7280]">
                    Trend grain:{' '}
                    <span className="font-medium text-[#111827]">
                      {data.trendGrain === 'week'
                        ? 'Weekly'
                        : data.trendGrain === 'month'
                          ? 'Monthly'
                          : 'Daily'}
                    </span>
                    {data.trendCoversFullRange
                      ? ' · covers the full selected period (KPIs always use the full range).'
                      : ' · chart coverage may be incomplete; period KPIs above remain authoritative.'}
                  </p>
                  <CashFlowChart data={chartData} />
                </>
              ) : (
                <p className="rounded-xl border border-dashed border-border bg-white p-6 text-center text-sm text-[#6B7280]">
                  No trend points for this range yet. Period KPIs above still use the full selection.
                </p>
              )}
              <div className="space-y-2 rounded-xl border border-border bg-white px-4 py-4 text-sm">
                <p className="font-medium text-[#111827]">How profit is calculated</p>
                <ul className="space-y-1 text-[#6B7280]">
                  <li>Sales revenue − sales returns = net sales</li>
                  <li>Net sales − product cost (sale_items.cost_price) = gross profit</li>
                  <li>Gross profit + other income − expenses = net profit</li>
                  <li>Cash deposit / withdraw never enter other income or expenses</li>
                </ul>
              </div>
            </div>
          ) : null}

          {tab === 'branch' ? (
            data.byBranch.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-white p-6 text-center text-sm text-[#6B7280]">
                No branch operating results in this period. Shared org expenses stay on their own branch —
                nothing is allocated artificially.
              </p>
            ) : (
              <DataTable
                headers={['Branch', 'Net sales', 'COGS', 'Gross', 'Other income', 'Expenses', 'Operating']}
                rows={data.byBranch.map((b) => [
                  b.branchName,
                  formatBDT(b.netSales),
                  formatBDT(b.productCost),
                  formatBDT(b.grossProfit),
                  formatBDT(b.otherIncome),
                  formatBDT(b.expenses),
                  formatBDT(b.operatingProfit),
                ])}
              />
            )
          ) : null}

          {tab === 'product' ? (
            data.byProduct.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-white p-6 text-center text-sm text-[#6B7280]">
                No product-level COGS rows for this period.
              </p>
            ) : (
              <DataTable
                headers={['Product', 'Qty', 'Revenue', 'Cost', 'Gross profit']}
                rows={data.byProduct.map((p) => [
                  p.productName,
                  String(p.qty),
                  formatBDT(p.revenue),
                  formatBDT(p.cost),
                  formatBDT(p.grossProfit),
                ])}
              />
            )
          ) : null}

          {tab === 'sale' ? (
            data.bySale.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-white p-6 text-center text-sm text-[#6B7280]">
                No sales in this period.
              </p>
            ) : (
              <DataTable
                headers={['Invoice', 'Date', 'Net sales', 'COGS', 'Gross profit']}
                rows={data.bySale.map((s) => [
                  s.invoiceNo,
                  s.saleDate,
                  formatBDT(s.netSales),
                  formatBDT(s.productCost),
                  formatBDT(s.grossProfit),
                ])}
              />
            )
          ) : null}

          {tab === 'statement' ? (
            <div className="rounded-xl border border-border bg-white px-4 py-5 text-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-[#9CA3AF]">
                Statement · {data.from} → {data.to}
              </p>
              <dl className="mt-3 space-y-2">
                {(
                  [
                    ['Net sales', data.netSales],
                    ['Product cost', -data.productCost],
                    ['Gross profit', data.grossProfit],
                    ['Other income', data.otherIncome],
                    ['Expenses', -data.expenses],
                    ['Net profit', data.netProfit],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between border-b border-border py-2 last:border-0">
                    <dt className="text-[#6B7280]">{label}</dt>
                    <dd
                      className={cn(
                        'font-semibold tabular-nums',
                        value >= 0 ? 'text-emerald-700' : 'text-rose-700',
                      )}
                    >
                      {formatBDT(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
