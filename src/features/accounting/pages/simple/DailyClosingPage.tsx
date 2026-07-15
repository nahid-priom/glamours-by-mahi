import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { simpleAccountingRepository } from '../../repositories/simple-accounting.repository'
import { PageHeader, ErrorText, KpiCard } from '../../components/AccountingUi'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/features/auth/auth-session'
import { formatBDT } from '@/lib/format'
import { queryKeys } from '@/lib/query/keys'

export function DailyClosingPage() {
  const { activeBranchId } = useAuth()
  const { toast } = useToast()
  const today = new Date().toISOString().slice(0, 10)
  const [businessDate, setBusinessDate] = useState(today)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [counted, setCounted] = useState('')
  const [notes, setNotes] = useState('')

  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: [...queryKeys.accounts, 'fa', activeBranchId],
    queryFn: () => simpleAccountingRepository.listFinancialAccounts(activeBranchId),
  })

  const cashAccounts = accounts.filter((a) => a.is_active && a.account_kind === 'cash')

  useEffect(() => {
    if (!accountId && cashAccounts[0]) setAccountId(cashAccounts[0].id)
  }, [accountId, cashAccounts])

  const { data: expected = 0, isLoading, error } = useQuery({
    queryKey: [...queryKeys.accounts, 'expected-cash', activeBranchId, accountId],
    queryFn: () => simpleAccountingRepository.getExpectedCash(activeBranchId, accountId),
  })

  const countedNum = Number(counted) || 0
  const difference = countedNum - expected

  const closeDay = useMutation({
    mutationFn: () =>
      simpleAccountingRepository.closeBusinessDay({
        business_date: businessDate,
        counted_cash: countedNum,
        expected_cash: expected,
        notes: notes || undefined,
        branch_id: activeBranchId,
        financial_account_id: accountId,
      }),
    onSuccess: () => {
      toast('Day closed')
      setNotes('')
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  return (
    <div className="mx-auto w-full max-w-lg min-w-0 space-y-4">
      <PageHeader
        title="Daily Closing"
        subtitle="Compare system balance with cash you counted in the drawer."
      />

      {loadingAccounts || isLoading ? <Skeleton className="h-24" /> : null}
      <ErrorText error={error} />

      <div className="grid gap-3 sm:grid-cols-2">
        <KpiCard label="Expected (system)" value={formatBDT(expected)} />
        <KpiCard
          label="Difference"
          value={formatBDT(difference)}
          hint={difference === 0 ? 'Matched' : difference > 0 ? 'Over' : 'Short'}
        />
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-white p-4">
        <div className="space-y-1">
          <Label>Business date</Label>
          <Input type="date" value={businessDate} onChange={(e) => setBusinessDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Cash account</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={accountId ?? ''}
            onChange={(e) => setAccountId(e.target.value || null)}
          >
            {cashAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label>Counted cash</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-1">
          <Label>Notes</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
        </div>
        <PermissionGate permission={['accounts.manage', 'accounts.post']}>
          <Button
            className="w-full"
            disabled={closeDay.isPending || counted === ''}
            onClick={() => closeDay.mutate()}
          >
            Close day
          </Button>
        </PermissionGate>
      </div>
    </div>
  )
}
