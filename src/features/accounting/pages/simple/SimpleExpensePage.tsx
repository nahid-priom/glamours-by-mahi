import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { simpleAccountingRepository } from '../../repositories/simple-accounting.repository'
import {
  PageHeader,
  DateRangeInputs,
  DataTable,
  ErrorText,
  EmptyState,
  KpiCard,
} from '../../components/AccountingUi'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/features/auth/auth-session'
import { formatBDT } from '@/lib/format'
import { queryKeys } from '@/lib/query/keys'
import { invalidateExpenseCaches } from '@/lib/mutations/party-finance-cache'

function monthRange() {
  const to = new Date().toISOString().slice(0, 10)
  return { from: `${to.slice(0, 7)}-01`, to }
}

export function SimpleExpensePage() {
  const { profile, activeBranchId } = useAuth()
  const qc = useQueryClient()
  const { toast } = useToast()
  const [range, setRange] = useState(monthRange)
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const { data = [], isLoading, error } = useQuery({
    queryKey: [...queryKeys.accounts, 'simple-expense', range, activeBranchId],
    queryFn: () =>
      simpleAccountingRepository.listExpenses({ ...range, branchId: activeBranchId }),
  })

  const { data: accounts = [] } = useQuery({
    queryKey: [...queryKeys.accounts, 'fa', activeBranchId],
    queryFn: () => simpleAccountingRepository.listFinancialAccounts(activeBranchId),
  })

  const { data: categories = [] } = useQuery({
    queryKey: [...queryKeys.accounts, 'expense-cats', profile?.organization_id],
    enabled: Boolean(profile?.organization_id),
    queryFn: () => simpleAccountingRepository.listExpenseCategories(profile!.organization_id),
  })

  const total = data.reduce((s, r) => s + r.amount, 0)

  const submitTxnKey = useRef<string | null>(null)

  const create = useMutation({
    mutationFn: async () => {
      if (!activeBranchId) throw new Error('Select an active branch first')
      const amt = Number(amount)
      if (!amt || amt <= 0) throw new Error('Enter a valid amount')
      const fa = accountId || accounts.find((a) => a.is_active)?.id
      if (!fa) throw new Error('Select a cash/bank account')
      const cat = categoryId || categories[0]?.id
      if (!cat) throw new Error('Select an expense category')
      if (!submitTxnKey.current) {
        submitTxnKey.current =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `expense-${Date.now()}`
      }
      return simpleAccountingRepository.createExpense({
        amount: amt,
        account_id: fa,
        category_id: cat,
        branch_id: activeBranchId,
        note: note || undefined,
        client_txn_key: submitTxnKey.current,
      })
    },
    onSuccess: async () => {
      toast('Expense recorded')
      setAmount('')
      setNote('')
      submitTxnKey.current = null
      await invalidateExpenseCaches(qc)
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const voidTxn = useMutation({
    mutationFn: (transactionId: string) =>
      simpleAccountingRepository.voidTransaction({
        transaction_id: transactionId,
        reason: 'Voided from expenses',
      }),
    onSuccess: async () => {
      toast('Transaction voided')
      await invalidateExpenseCaches(qc)
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 space-y-4">
      <PageHeader title="Expenses" subtitle="Money leaving the business for running costs." />
      <DateRangeInputs from={range.from} to={range.to} onChange={setRange} />
      <KpiCard label="Total money out" value={formatBDT(total)} />

      <PermissionGate permission={['accounts.manage', 'accounts.post']}>
        <div className="grid gap-2 rounded-xl border border-border bg-white p-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <Label>Amount</Label>
            <Input type="number" min={0.01} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Category</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Select…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>From account</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
              value={accountId ?? ''}
              onChange={(e) => setAccountId(e.target.value || null)}
            >
              <option value="">Default</option>
              {accounts
                .filter((a) => a.is_active)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Note</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
          </div>
          <div className="flex items-end">
            <Button
              className="w-full"
              disabled={create.isPending || !activeBranchId}
              onClick={() => create.mutate()}
            >
              Record expense
            </Button>
          </div>
        </div>
        {!activeBranchId ? (
          <p className="text-xs text-amber-700">Select an active branch to record expenses.</p>
        ) : null}
      </PermissionGate>

      {isLoading ? <Skeleton className="h-40" /> : null}
      <ErrorText error={error} />
      {!isLoading && data.length === 0 ? <EmptyState message="No expenses for this period." /> : null}
      {data.length > 0 ? (
        <DataTable
          headers={['Date', 'Category', 'Note', 'Amount', '']}
          rows={data.map((r) => [
            r.date,
            r.category,
            r.description || '—',
            formatBDT(r.amount),
            r.transactionId ? (
              <PermissionGate key={r.id} permission={['accounts.manage', 'accounts.post']}>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={voidTxn.isPending}
                  onClick={() => {
                    if (confirm('Void this expense?')) voidTxn.mutate(r.transactionId!)
                  }}
                >
                  Void
                </Button>
              </PermissionGate>
            ) : (
              '—'
            ),
          ])}
        />
      ) : null}
    </div>
  )
}
