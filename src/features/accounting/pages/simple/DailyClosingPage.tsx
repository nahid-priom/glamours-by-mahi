import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { simpleAccountingRepository } from '../../repositories/simple-accounting.repository'
import { PageHeader, ErrorText, KpiCard } from '../../components/AccountingUi'
import { FinancialAccountSelectField } from '@/components/payments/FinancialAccountSelectField'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { AppDateField } from '@/components/date-picker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/features/auth/auth-session'
import { todayYmd } from '@/lib/datetime/bd'
import { formatBDT } from '@/lib/format'
import { queryKeys } from '@/lib/query/keys'
import { toastRpcError } from '@/lib/errors/rpc-error'

export function DailyClosingPage() {
  const { activeBranchId } = useAuth()
  const { toast } = useToast()
  const [businessDate, setBusinessDate] = useState(() => todayYmd())
  const [accountId, setAccountId] = useState<string | null>(null)
  const [counted, setCounted] = useState('')
  const [notes, setNotes] = useState('')

  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: [...queryKeys.accounts, 'fa', activeBranchId],
    queryFn: () => simpleAccountingRepository.listFinancialAccounts(activeBranchId),
  })

  const cashAccounts = accounts.filter((a) => a.is_active && a.account_kind === 'cash')

  // Clear selection if the chosen FA is no longer an eligible cash account.
  useEffect(() => {
    if (!accountId) return
    if (!cashAccounts.some((a) => a.id === accountId)) setAccountId(null)
  }, [accountId, cashAccounts])

  const { data: expected = 0, isLoading, error } = useQuery({
    queryKey: [...queryKeys.accounts, 'expected-cash', activeBranchId, accountId],
    queryFn: () => simpleAccountingRepository.getExpectedCash(activeBranchId, accountId),
  })

  const countedEntered = counted.trim() !== ''
  const countedNum = countedEntered ? Number(counted) : NaN
  const difference = countedEntered && Number.isFinite(countedNum) ? countedNum - expected : null

  const closeDay = useMutation({
    mutationFn: () => {
      if (!accountId) throw new Error('Select a cash account')
      if (!countedEntered || !Number.isFinite(countedNum) || countedNum < 0) {
        throw new Error('Enter counted cash before closing')
      }
      return simpleAccountingRepository.closeBusinessDay({
        business_date: businessDate,
        counted_cash: countedNum,
        expected_cash: expected,
        notes: notes || undefined,
        branch_id: activeBranchId,
        financial_account_id: accountId,
      })
    },
    onSuccess: () => {
      toast('Day closed')
      setNotes('')
    },
    onError: (e: Error) => toastRpcError(toast, e),
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
          value={difference == null ? 'Not calculated' : formatBDT(difference)}
          hint={
            difference == null
              ? 'Enter counted cash'
              : difference === 0
                ? 'Matched'
                : difference > 0
                  ? 'Surplus'
                  : 'Shortage'
          }
        />
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-white p-4">
        <div className="space-y-1">
          <Label>Business date</Label>
          <AppDateField value={businessDate} onChange={setBusinessDate} />
        </div>
        <FinancialAccountSelectField
          label="Cash account"
          value={accountId}
          onChange={setAccountId}
          accounts={loadingAccounts ? [] : cashAccounts}
          kinds={['cash']}
          emptyPlaceholder="Select cash account…"
        />
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
        <PermissionGate permission={['daily_closing.create', 'accounts.manage', 'accounts.post']}>
          <Button
            className="w-full"
            disabled={
              closeDay.isPending ||
              !accountId ||
              !countedEntered ||
              !Number.isFinite(countedNum)
            }
            onClick={() => closeDay.mutate()}
          >
            Close day
          </Button>
        </PermissionGate>
      </div>
    </div>
  )
}
