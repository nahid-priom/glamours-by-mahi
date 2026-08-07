import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { simpleAccountingRepository } from '../../repositories/simple-accounting.repository'
import { PageHeader, DateRangeInputs, ErrorText, KpiCard } from '../../components/AccountingUi'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/auth-session'
import { addDaysYmd, resolveShortcut, todayYmd } from '@/lib/datetime/bd'
import { formatBDT } from '@/lib/format'
import { queryKeys } from '@/lib/query/keys'

function monthRange() {
  return resolveShortcut('this_month')
}

function presetRange(kind: 'today' | 'yesterday' | 'week' | 'month') {
  if (kind === 'today') return resolveShortcut('today')
  if (kind === 'week') return resolveShortcut('this_week')
  if (kind === 'month') return resolveShortcut('this_month')
  const d = addDaysYmd(todayYmd(), -1)
  return { from: d, to: d }
}

export function SimpleProfitLossPage() {
  const { activeBranchId } = useAuth()
  const [range, setRange] = useState(monthRange)

  const { data, isLoading, error } = useQuery({
    queryKey: [...queryKeys.accounts, 'simple-pl', range, activeBranchId],
    queryFn: () => simpleAccountingRepository.getProfitLoss(range.from, range.to, activeBranchId),
  })

  return (
    <div className="mx-auto w-full max-w-3xl min-w-0 space-y-4">
      <PageHeader
        title="Profit & Loss"
        subtitle="How much you sold, spent, and kept — in plain language."
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

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : null}
      <ErrorText error={error} />

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard label="Net sales" value={formatBDT(data.netSales)} hint="Sales minus returns" />
            <KpiCard label="Product cost" value={formatBDT(data.productCost ?? 0)} />
            <KpiCard
              label="Gross profit"
              value={formatBDT(data.grossProfit ?? data.gross)}
              hint="Net sales − product cost"
            />
            <KpiCard label="Other income" value={formatBDT(data.otherIncome)} />
            <KpiCard label="Expenses" value={formatBDT(data.expenses)} />
            <KpiCard
              label="Margin"
              value={`${(data.margin ?? 0).toFixed(1)}%`}
              hint="Net profit ÷ net sales"
            />
          </div>

          <div className="space-y-2 rounded-xl border border-border bg-white px-4 py-4 text-sm">
            <p className="font-medium text-[#111827]">How profit is calculated</p>
            <ul className="space-y-1 text-[#6B7280]">
              <li>Sales revenue − sales returns = net sales</li>
              <li>Net sales − product cost = gross profit</li>
              <li>Gross profit + other income − expenses = net profit</li>
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-white px-4 py-5">
            <p className="text-xs font-medium uppercase tracking-wide text-[#9CA3AF]">Net profit</p>
            <p
              className={`mt-1 text-2xl font-bold ${
                data.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {formatBDT(data.netProfit)}
            </p>
            <p className="mt-1 text-xs text-[#6B7280]">
              For {data.from} to {data.to}
            </p>
          </div>
        </>
      ) : null}
    </div>
  )
}
