import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { simpleAccountingRepository, type AccountKind } from '../../repositories/simple-accounting.repository'
import { PageHeader, ErrorText, EmptyState, Money } from '../../components/AccountingUi'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/features/auth/auth-session'
import { formatBDT } from '@/lib/format'
import { queryKeys } from '@/lib/query/keys'

type DialogMode = 'deposit' | 'withdraw' | 'transfer' | 'add' | null

export function CashBankPage() {
  const { profile, activeBranchId } = useAuth()
  const qc = useQueryClient()
  const { toast } = useToast()
  const [mode, setMode] = useState<DialogMode>(null)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [toAccountId, setToAccountId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [name, setName] = useState('')
  const [kind, setKind] = useState<AccountKind>('cash')
  const [opening, setOpening] = useState('0')

  const { data = [], isLoading, error } = useQuery({
    queryKey: [...queryKeys.accounts, 'cash-bank', activeBranchId],
    queryFn: () => simpleAccountingRepository.listFinancialAccounts(activeBranchId),
  })

  const { data: incomeCats = [] } = useQuery({
    queryKey: [...queryKeys.accounts, 'income-cats', profile?.organization_id],
    enabled: Boolean(profile?.organization_id),
    queryFn: () => simpleAccountingRepository.listIncomeCategories(profile!.organization_id),
  })

  const { data: expenseCats = [] } = useQuery({
    queryKey: [...queryKeys.accounts, 'expense-cats', profile?.organization_id],
    enabled: Boolean(profile?.organization_id),
    queryFn: () => simpleAccountingRepository.listExpenseCategories(profile!.organization_id),
  })

  const activeAccounts = useMemo(() => data.filter((a) => a.is_active), [data])

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: queryKeys.accounts })
  }

  const mutateMove = useMutation({
    mutationFn: async () => {
      if (!activeBranchId) throw new Error('Select an active branch first')
      const amt = Number(amount)
      if (!amt || amt <= 0) throw new Error('Enter a valid amount')
      if (!accountId) throw new Error('Select an account')
      if (mode === 'deposit') {
        const category_id =
          incomeCats.find((c) => /deposit|other/i.test(c.name))?.id ?? incomeCats[0]?.id
        if (!category_id) throw new Error('No income category configured')
        return simpleAccountingRepository.createIncome({
          amount: amt,
          account_id: accountId,
          category_id,
          branch_id: activeBranchId,
          note: note || 'Deposit',
        })
      }
      if (mode === 'withdraw') {
        const category_id =
          expenseCats.find((c) => /withdraw|misc/i.test(c.name))?.id ?? expenseCats[0]?.id
        if (!category_id) throw new Error('No expense category configured')
        return simpleAccountingRepository.createExpense({
          amount: amt,
          account_id: accountId,
          category_id,
          branch_id: activeBranchId,
          note: note || 'Withdraw',
        })
      }
      if (mode === 'transfer') {
        if (!toAccountId) throw new Error('Select destination account')
        if (toAccountId === accountId) throw new Error('Pick a different destination')
        return simpleAccountingRepository.transferBalance({
          from_account_id: accountId,
          to_account_id: toAccountId,
          amount: amt,
          description: note || 'Transfer',
          branch_id: activeBranchId,
        })
      }
      throw new Error('Unknown action')
    },
    onSuccess: async () => {
      toast('Saved')
      setMode(null)
      setAmount('')
      setNote('')
      await invalidate()
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const mutateAdd = useMutation({
    mutationFn: async () => {
      if (!profile?.organization_id) throw new Error('Not signed in')
      if (!name.trim()) throw new Error('Name required')
      return simpleAccountingRepository.upsertAccount({
        organization_id: profile.organization_id,
        name: name.trim(),
        account_kind: kind,
        branch_id: activeBranchId,
        opening_balance: Number(opening) || 0,
      })
    },
    onSuccess: async () => {
      toast('Account added')
      setMode(null)
      setName('')
      setOpening('0')
      await invalidate()
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const openMove = (m: DialogMode, id?: string) => {
    setMode(m)
    setAccountId(id ?? activeAccounts[0]?.id ?? null)
    setToAccountId(null)
    setAmount('')
    setNote('')
  }

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 space-y-4">
      <PageHeader
        title="Cash & Bank"
        subtitle="Balances for cash drawers, banks, and mobile wallets."
        actions={
          <PermissionGate permission={['accounts.manage', 'accounts.post']}>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => openMove('deposit')}>
                Deposit
              </Button>
              <Button size="sm" variant="outline" onClick={() => openMove('withdraw')}>
                Withdraw
              </Button>
              <Button size="sm" variant="outline" onClick={() => openMove('transfer')}>
                Transfer
              </Button>
              <Button size="sm" onClick={() => setMode('add')}>
                Add account
              </Button>
            </div>
          </PermissionGate>
        }
      />

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : null}
      <ErrorText error={error} />
      {!isLoading && activeAccounts.length === 0 ? (
        <EmptyState message="No cash or bank accounts yet." />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {activeAccounts.map((a) => (
          <div key={a.id} className="min-w-0 rounded-xl border border-border bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-[#111827]">{a.name}</p>
                <p className="text-xs capitalize text-[#6B7280]">{a.account_kind.replace('_', ' ')}</p>
              </div>
              {a.is_default ? (
                <span className="shrink-0 text-[10px] font-medium uppercase text-[#9CA3AF]">Default</span>
              ) : null}
            </div>
            <p className="mt-3 text-xl font-bold text-[#111827]">
              <Money value={a.current_balance} />
            </p>
            <p className="text-xs text-[#6B7280]">Opening {formatBDT(a.opening_balance)}</p>
            <PermissionGate permission={['accounts.manage', 'accounts.post']}>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => openMove('deposit', a.id)}>
                  Deposit
                </Button>
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => openMove('withdraw', a.id)}>
                  Withdraw
                </Button>
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => openMove('transfer', a.id)}>
                  Transfer
                </Button>
              </div>
            </PermissionGate>
          </div>
        ))}
      </div>

      <Dialog open={mode === 'deposit' || mode === 'withdraw' || mode === 'transfer'} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {mode === 'deposit' ? 'Deposit' : mode === 'withdraw' ? 'Withdraw' : 'Transfer'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>{mode === 'transfer' ? 'From account' : 'Account'}</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={accountId ?? ''}
                onChange={(e) => setAccountId(e.target.value || null)}
              >
                {activeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({formatBDT(a.current_balance)})
                  </option>
                ))}
              </select>
            </div>
            {mode === 'transfer' ? (
              <div className="space-y-1">
                <Label>To account</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={toAccountId ?? ''}
                  onChange={(e) => setToAccountId(e.target.value || null)}
                >
                  <option value="">Select…</option>
                  {activeAccounts
                    .filter((a) => a.id !== accountId)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </select>
              </div>
            ) : null}
            <div className="space-y-1">
              <Label>Amount</Label>
              <Input type="number" min={0.01} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Note</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
            </div>
            <Button className="w-full" disabled={mutateMove.isPending} onClick={() => mutateMove.mutate()}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={mode === 'add'} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add account</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Cash drawer / Bank name" />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={kind}
                onChange={(e) => setKind(e.target.value as AccountKind)}
              >
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="mobile_money">Mobile money</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Opening balance</Label>
              <Input type="number" value={opening} onChange={(e) => setOpening(e.target.value)} />
            </div>
            <Button className="w-full" disabled={mutateAdd.isPending} onClick={() => mutateAdd.mutate()}>
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
