import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  Building2,
  Settings2,
  Users,
  Wallet,
} from 'lucide-react'
import { simpleAccountingRepository } from '../../repositories/simple-accounting.repository'
import {
  financialQueries,
  financialQueryKeys,
  totalAccountBalance,
} from '../../lib/financial-queries'
import { PageHeader, KpiCard, ErrorText, Money, DateRangeInputs } from '../../components/AccountingUi'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-session'
import { useReportFilters } from '@/features/reports/hooks/use-report-filters'
import { formatBDT } from '@/lib/format'
import { cn } from '@/lib/utils'

const quickActions = [
  { label: 'Income', to: '/accounts/income', tone: 'pink' as const },
  { label: 'Expense', to: '/accounts/expenses', tone: 'pink' as const },
  { label: 'Transfer', to: '/accounts/cash-bank?action=transfer', tone: 'blue' as const },
  { label: 'Deposit', to: '/accounts/cash-bank?action=deposit', tone: 'green' as const },
  { label: 'Withdraw', to: '/accounts/cash-bank?action=withdraw', tone: 'rose' as const },
  { label: 'Collect Due', to: '/accounts/dues?tab=customers', tone: 'pink' as const },
  { label: 'Pay Supplier', to: '/accounts/dues?tab=suppliers', tone: 'pink' as const },
]

function kindLabel(kind: string) {
  if (kind === 'cash') return 'Cash'
  if (kind === 'bank') return 'Bank'
  if (kind === 'mobile_money') return 'Mobile'
  return 'Other'
}

export function SimpleAccountsDashboardPage() {
  const { activeBranchId } = useAuth()
  const { range, setFilters } = useReportFilters()
  const setRange = (next: { from: string; to: string }) => setFilters(next)

  const accountsQuery = useQuery({
    queryKey: financialQueryKeys.hubAccounts(activeBranchId),
    queryFn: () => financialQueries.listFinancialAccounts(activeBranchId),
  })

  const cashFlowQuery = useQuery({
    queryKey: financialQueryKeys.hubCashFlow(activeBranchId, range.from, range.to),
    queryFn: () => financialQueries.getPeriodCashFlow(range.from, range.to, activeBranchId),
  })

  const recentQuery = useQuery({
    queryKey: financialQueryKeys.hubRecent(activeBranchId),
    queryFn: () =>
      simpleAccountingRepository.listTransactions({
        branchId: activeBranchId,
        limit: 12,
      }),
  })

  const cashFlow = cashFlowQuery.data
  const totalBalance = useMemo(
    () => totalAccountBalance(accountsQuery.data ?? []),
    [accountsQuery.data],
  )
  const activeAccounts = useMemo(
    () => (accountsQuery.data ?? []).filter((a) => a.is_active),
    [accountsQuery.data],
  )

  const loading = accountsQuery.isLoading || cashFlowQuery.isLoading
  const error = accountsQuery.error || cashFlowQuery.error || recentQuery.error

  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 space-y-4">
      <PageHeader
        title="Accounts Management"
        subtitle="Manage all cash, bank and mobile accounts, and record income, expense, deposit, withdrawal and transfer."
        actions={
          <div className="flex flex-wrap gap-2">
            <DateRangeInputs from={range.from} to={range.to} onChange={setRange} />
            <Button asChild size="sm" variant="outline">
              <Link to={`/accounts/transactions?${new URLSearchParams(range)}`}>Transactions</Link>
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : null}
      <ErrorText error={error} />

      {!loading && cashFlow ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard label="Total Balance (All Accounts)" value={formatBDT(totalBalance)} hint="Live balances" />
          <KpiCard
            label="Total Money In"
            value={formatBDT(cashFlow.moneyIn)}
            hint={`Period · excl. transfers · ${cashFlow.txnCount} txns`}
          />
          <KpiCard label="Total Money Out" value={formatBDT(cashFlow.moneyOut)} hint="Period · excl. transfers" />
          <KpiCard label="Total Transfer" value={formatBDT(cashFlow.transferVolume)} hint="Period transfer volume" />
          <KpiCard
            label="Net Cash Flow"
            value={formatBDT(cashFlow.netCashFlow)}
            hint="Money in − money out (complete period)"
          />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-2 rounded-xl border border-border bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[#111827]">My Accounts</h2>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link to="/accounts/cash-bank">Add account</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/accounts/settings">Manage / settings</Link>
              </Button>
            </div>
          </div>
          {activeAccounts.length === 0 ? (
            <p className="text-sm text-[#6B7280]">No active accounts for this branch scope.</p>
          ) : (
            <ul className="divide-y divide-border">
              {activeAccounts.map((a) => (
                <li key={a.id} className="flex items-center gap-2 py-2.5">
                  <Link
                    to={`/accounts/transactions?accountId=${a.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 hover:bg-[#F9FAFB]"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFF1F2] text-[#E11D48]">
                      <Wallet className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#111827]">{a.name}</p>
                      <p className="text-xs text-[#6B7280]">
                        {kindLabel(a.account_kind)}
                        {a.branch_id ? '' : ' · Org-wide'}
                        {a.is_default ? ' · Default' : ''}
                        {a.is_active ? '' : ' · Inactive'}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-[#111827]">
                      {formatBDT(a.current_balance)}
                    </span>
                  </Link>
                  <Button asChild size="sm" variant="ghost" className="h-8 shrink-0 px-2 text-xs">
                    <Link to="/accounts/settings">Manage</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2 rounded-xl border border-border bg-white p-4">
          <h2 className="text-sm font-semibold text-[#111827]">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map((a) => (
              <Link
                key={a.label}
                to={a.to}
                className={cn(
                  'rounded-xl border px-3 py-3 text-center text-sm font-medium transition',
                  a.tone === 'blue' && 'border-sky-200 bg-sky-50 text-sky-800 hover:border-sky-300',
                  a.tone === 'green' &&
                    'border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300',
                  a.tone === 'rose' && 'border-rose-200 bg-rose-50 text-rose-800 hover:border-rose-300',
                  a.tone === 'pink' &&
                    'border-[#E11D48]/25 bg-[#FFF1F2] text-[#BE123C] hover:border-[#E11D48]/45',
                )}
              >
                {a.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-2 text-xs">
            <Link to="/accounts/daily-closing" className="text-[#6B7280] hover:text-[#E11D48]">
              Daily Closing
            </Link>
            <span className="text-[#D1D5DB]">·</span>
            <Link to="/accounts/reconciliation" className="text-[#6B7280] hover:text-[#E11D48]">
              Reconciliation
            </Link>
            <span className="text-[#D1D5DB]">·</span>
            <Link
              to="/accounts/settings"
              className="inline-flex items-center gap-1 text-[#6B7280] hover:text-[#E11D48]"
            >
              <Settings2 className="h-3 w-3" /> Settings
            </Link>
          </div>
        </section>
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[#111827]">Recent Transactions</h2>
          <Link to="/accounts/transactions" className="text-xs font-medium text-[#E11D48]">
            View All
          </Link>
        </div>
        {recentQuery.isLoading ? <Skeleton className="h-40" /> : null}
        {(recentQuery.data?.length ?? 0) === 0 && !recentQuery.isLoading ? (
          <p className="rounded-xl border border-dashed border-border bg-white p-6 text-center text-sm text-[#6B7280]">
            No recent money movements.
          </p>
        ) : null}
        {(recentQuery.data?.length ?? 0) > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-border bg-white">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b bg-[#F9FAFB] text-xs uppercase tracking-wide text-[#6B7280]">
                <tr>
                  <th className="px-3 py-2 font-medium">Reference</th>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Account</th>
                  <th className="px-3 py-2 font-medium">Note</th>
                  <th className="px-3 py-2 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(recentQuery.data ?? []).map((t) => (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="px-3 py-2 font-mono text-xs">{t.entryNo ?? t.id.slice(0, 8)}</td>
                    <td className="px-3 py-2 text-[#6B7280]">{t.date}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1">
                        {t.direction === 'in' ? (
                          <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <ArrowUpRight className="h-3.5 w-3.5 text-rose-600" />
                        )}
                        {t.category ?? (t.direction === 'in' ? 'Money in' : 'Money out')}
                      </span>
                    </td>
                    <td className="px-3 py-2">{t.accountName ?? '—'}</td>
                    <td className="max-w-[12rem] truncate px-3 py-2 text-[#6B7280]">{t.description}</td>
                    <td
                      className={cn(
                        'px-3 py-2 text-right font-semibold tabular-nums',
                        t.direction === 'in' ? 'text-emerald-700' : 'text-rose-700',
                      )}
                    >
                      <Money value={t.direction === 'in' ? t.amount : -t.amount} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          to="/accounts/cash-bank"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2"
        >
          <Banknote className="h-4 w-4 text-[#6B7280]" /> Cash &amp; Bank
        </Link>
        <Link
          to="/accounts/dues?tab=customers"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2"
        >
          <Users className="h-4 w-4 text-[#6B7280]" /> Customer Due
        </Link>
        <Link
          to="/accounts/dues?tab=suppliers"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2"
        >
          <Building2 className="h-4 w-4 text-[#6B7280]" /> Supplier Due
        </Link>
        <Link
          to="/accounts/transactions"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2"
        >
          <ArrowLeftRight className="h-4 w-4 text-[#6B7280]" /> All Transactions
        </Link>
      </div>
    </div>
  )
}
