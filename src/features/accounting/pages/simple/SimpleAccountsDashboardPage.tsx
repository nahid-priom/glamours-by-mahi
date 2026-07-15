import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowDownLeft, ArrowUpRight, Banknote, Users, Building2 } from 'lucide-react'
import { simpleAccountingRepository } from '../../repositories/simple-accounting.repository'
import { PageHeader, KpiCard, ErrorText, Money } from '../../components/AccountingUi'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-session'
import { formatBDT } from '@/lib/format'
import { queryKeys } from '@/lib/query/keys'

const quickActions = [
  { label: 'Add Income', to: '/accounts/income' },
  { label: 'Add Expense', to: '/accounts/expenses' },
  { label: 'Collect Due', to: '/accounts/collections' },
  { label: 'Pay Supplier', to: '/accounts/supplier-payments' },
  { label: 'Transfer Money', to: '/accounts/cash-bank' },
  { label: 'Close Today', to: '/accounts/daily-closing' },
]

export function SimpleAccountsDashboardPage() {
  const { activeBranchId } = useAuth()
  const { data, isLoading, error } = useQuery({
    queryKey: [...queryKeys.accounts, 'simple-dashboard', activeBranchId],
    queryFn: () => simpleAccountingRepository.getDashboardKpis(activeBranchId),
  })

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 space-y-4">
      <PageHeader
        title="Accounts"
        subtitle="Money in, money out, dues, and balance at a glance."
        actions={
          <Button asChild size="sm" variant="outline">
            <Link to="/accounts/transactions">All transactions</Link>
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : null}
      <ErrorText error={error} />

      {data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard label="Today's Sales" value={formatBDT(data.todaySales ?? 0)} />
          <KpiCard label="Today's Collection" value={formatBDT(data.todayCollection ?? 0)} />
          <KpiCard label="Today's Expenses" value={formatBDT(data.todayExpenses ?? 0)} />
          <KpiCard
            label="Cash"
            value={formatBDT(data.cashDrawerBalance ?? data.cashBalance ?? 0)}
          />
          <KpiCard label="Bank" value={formatBDT(data.bankBalance ?? 0)} />
          <KpiCard label="Mobile" value={formatBDT(data.mobileBalance ?? 0)} />
          <KpiCard label="Customer Due" value={formatBDT(data.customerDue)} />
          <KpiCard label="Supplier Due" value={formatBDT(data.supplierDue)} />
          <KpiCard label="Today's Profit" value={formatBDT(data.todayProfit ?? data.netProfit ?? 0)} />
          <KpiCard label="Month Profit" value={formatBDT(data.monthProfit ?? data.netProfit ?? 0)} />
        </div>
      ) : null}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-[#111827]">Quick actions</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className="rounded-xl border border-border bg-white px-3 py-2.5 text-sm hover:border-[#E11D48]/40"
            >
              {a.label}
            </Link>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[#111827]">Recent transactions</h2>
          <Link to="/accounts/transactions" className="text-xs text-[#E11D48]">
            View all
          </Link>
        </div>
        {isLoading ? <Skeleton className="h-40" /> : null}
        {data && (data.recentTxns ?? data.recent).length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-white p-6 text-center text-sm text-[#6B7280]">
            No recent money movements.
          </p>
        ) : null}
        {data && (data.recentTxns ?? data.recent).length > 0 ? (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-white">
            {(data.recentTxns ?? data.recent).map((t) => (
              <li key={t.id} className="flex min-w-0 items-center gap-3 px-3 py-2.5 text-sm">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    t.direction === 'in' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                  }`}
                >
                  {t.direction === 'in' ? (
                    <ArrowDownLeft className="h-4 w-4" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-[#111827]">{t.description}</p>
                  <p className="truncate text-xs text-[#6B7280]">
                    {t.date} · {t.accountName ?? 'Account'} · {t.direction === 'in' ? 'Money in' : 'Money out'}
                  </p>
                </div>
                <span
                  className={`shrink-0 font-semibold ${
                    t.direction === 'in' ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  <Money value={t.amount} />
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        <div className="rounded-xl border border-border bg-white px-3 py-3">
          <p className="text-xs text-[#6B7280]">Account balances</p>
          <p className="mt-1 font-semibold text-[#111827]">
            {formatBDT((data?.cashDrawerBalance ?? 0) + (data?.bankBalance ?? 0) + (data?.mobileBalance ?? 0))}
          </p>
          <Link to="/accounts/cash-bank" className="mt-1 inline-block text-xs text-[#E11D48]">
            Open cash & bank
          </Link>
        </div>
        <div className="rounded-xl border border-border bg-white px-3 py-3">
          <p className="text-xs text-[#6B7280]">Due collection</p>
          <p className="mt-1 font-semibold text-[#111827]">{formatBDT(data?.customerDue ?? 0)} owed</p>
          <Link to="/accounts/collections" className="mt-1 inline-block text-xs text-[#E11D48]">
            Collect now
          </Link>
        </div>
        <div className="rounded-xl border border-border bg-white px-3 py-3">
          <p className="text-xs text-[#6B7280]">Today&apos;s expenses</p>
          <p className="mt-1 font-semibold text-[#111827]">{formatBDT(data?.todayExpenses ?? 0)}</p>
          <Link to="/accounts/expenses" className="mt-1 inline-block text-xs text-[#E11D48]">
            View expenses
          </Link>
        </div>
        <div className="rounded-xl border border-border bg-white px-3 py-3">
          <p className="text-xs text-[#6B7280]">Daily closing</p>
          <p className="mt-1 font-semibold text-[#111827]">Close today&apos;s cash</p>
          <Link to="/accounts/daily-closing" className="mt-1 inline-block text-xs text-[#E11D48]">
            Open closing
          </Link>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3 text-sm">
        <Link
          to="/accounts/cash-bank"
          className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2.5"
        >
          <Banknote className="h-4 w-4 text-[#6B7280]" /> Cash & bank
        </Link>
        <Link
          to="/accounts/customer-due"
          className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2.5"
        >
          <Users className="h-4 w-4 text-[#6B7280]" /> Customer due
        </Link>
        <Link
          to="/accounts/supplier-due"
          className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2.5"
        >
          <Building2 className="h-4 w-4 text-[#6B7280]" /> Supplier due
        </Link>
      </div>
    </div>
  )
}
