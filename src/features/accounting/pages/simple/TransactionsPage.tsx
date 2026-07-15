import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { simpleAccountingRepository, type TxnDirection } from '../../repositories/simple-accounting.repository'
import {
  PageHeader,
  DateRangeInputs,
  DataTable,
  ErrorText,
  EmptyState,
} from '../../components/AccountingUi'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/auth-session'
import { formatBDT } from '@/lib/format'
import { queryKeys } from '@/lib/query/keys'
import { cn } from '@/lib/utils'

function monthRange() {
  const to = new Date().toISOString().slice(0, 10)
  return { from: `${to.slice(0, 7)}-01`, to }
}

export function TransactionsPage() {
  const { activeBranchId } = useAuth()
  const [range, setRange] = useState(monthRange)
  const [direction, setDirection] = useState<TxnDirection>('all')
  const [accountId, setAccountId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const { data: accounts = [] } = useQuery({
    queryKey: [...queryKeys.accounts, 'fa', activeBranchId],
    queryFn: () => simpleAccountingRepository.listFinancialAccounts(activeBranchId),
  })

  const { data = [], isLoading, error } = useQuery({
    queryKey: [...queryKeys.accounts, 'txns', range, direction, accountId, search, activeBranchId],
    queryFn: () =>
      simpleAccountingRepository.listTransactions({
        from: range.from,
        to: range.to,
        direction,
        accountId,
        branchId: activeBranchId,
        search: search || undefined,
        limit: 200,
      }),
  })

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 space-y-4">
      <PageHeader title="Transactions" subtitle="All money in and money out in one place." />

      <div className="flex flex-wrap items-end gap-2">
        <DateRangeInputs from={range.from} to={range.to} onChange={setRange} />
        <div className="flex rounded-md border border-border bg-white p-0.5 text-xs">
          {(
            [
              ['all', 'All'],
              ['in', 'Money In'],
              ['out', 'Money Out'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={cn(
                'rounded px-2.5 py-1.5 font-medium',
                direction === value ? 'bg-[#111827] text-white' : 'text-[#6B7280]',
              )}
              onClick={() => setDirection(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          className="h-9 rounded-md border border-border bg-white px-2 text-sm"
          value={accountId ?? ''}
          onChange={(e) => setAccountId(e.target.value || null)}
        >
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <Input
          className="max-w-xs"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? <Skeleton className="h-48" /> : null}
      <ErrorText error={error} />
      {!isLoading && data.length === 0 ? <EmptyState message="No transactions found." /> : null}
      {data.length > 0 ? (
        <DataTable
          headers={['Date', 'Type', 'Account', 'Note', 'Amount']}
          rows={data.map((t) => [
            t.date,
            t.direction === 'in' ? 'Money In' : 'Money Out',
            t.accountName || '—',
            t.description,
            <span
              key={t.id}
              className={t.direction === 'in' ? 'font-medium text-emerald-700' : 'font-medium text-rose-700'}
            >
              {formatBDT(t.amount)}
            </span>,
          ])}
        />
      ) : null}
    </div>
  )
}
