import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { simpleAccountingRepository } from '../../repositories/simple-accounting.repository'
import { PageHeader, DataTable, ErrorText, EmptyState, KpiCard } from '../../components/AccountingUi'
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
import { invalidateCustomerCollectionCaches } from '@/lib/mutations/party-finance-cache'
import {
  NO_PAYMENT_ACCOUNT_MESSAGE,
  resolvePaymentAccount,
} from '@/lib/payments/resolve-payment-account'
import { listPaymentMethods } from '@/features/sales/repositories/sales.repository'
import { toastRpcError } from '@/lib/errors/rpc-error'

export function CustomerDuePage() {
  const { activeBranchId, profile } = useAuth()
  const qc = useQueryClient()
  const { toast } = useToast()
  const [selected, setSelected] = useState<{ id: string; name: string; due: number } | null>(null)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')

  const { data = [], isLoading, error } = useQuery({
    queryKey: [...queryKeys.accounts, 'customer-dues'],
    queryFn: () => simpleAccountingRepository.listCustomerDues(),
  })

  const { data: methods = [] } = useQuery({
    queryKey: queryKeys.paymentMethods,
    queryFn: listPaymentMethods,
  })

  const { data: accounts = [] } = useQuery({
    queryKey: [...queryKeys.accounts, 'fa', activeBranchId],
    queryFn: () => simpleAccountingRepository.listFinancialAccounts(activeBranchId),
  })

  const { data: settings } = useQuery({
    queryKey: [...queryKeys.accounts, 'settings', profile?.organization_id],
    enabled: Boolean(profile?.organization_id),
    queryFn: () => simpleAccountingRepository.getAccountSettings(profile!.organization_id),
  })

  const payMethods = useMemo(() => methods.filter((m) => !m.is_due), [methods])

  const resolved = useMemo(
    () =>
      resolvePaymentAccount({
        methodCode: method,
        branchId: activeBranchId,
        methods: payMethods,
        accounts,
        settings: settings ?? null,
      }),
    [method, activeBranchId, payMethods, accounts, settings],
  )

  const totalDue = data.reduce((s, r) => s + r.due, 0)

  const collect = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('Select a customer')
      if (!activeBranchId) throw new Error('Select an active branch first')
      const amt = Number(amount)
      if (!amt || amt <= 0) throw new Error('Enter a valid amount')
      const receiveAccountId = resolved?.account.id ?? null
      if (!receiveAccountId) throw new Error(NO_PAYMENT_ACCOUNT_MESSAGE)
      return simpleAccountingRepository.collectCustomerDue({
        customer_id: selected.id,
        amount: amt,
        payment_method: method,
        financial_account_id: receiveAccountId,
        branch_id: activeBranchId,
        reference: reference || null,
      })
    },
    onSuccess: async () => {
      toast('Collection recorded')
      const customerId = selected?.id
      setSelected(null)
      setAmount('')
      setReference('')
      await invalidateCustomerCollectionCaches(qc, {
        customerId,
        branchId: activeBranchId,
      })
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 space-y-4">
      <PageHeader title="Customer Due" subtitle="Customers who still owe money." />
      <KpiCard label="Total due" value={formatBDT(totalDue)} />

      {isLoading ? <Skeleton className="h-40" /> : null}
      <ErrorText error={error} />
      {!isLoading && data.length === 0 ? <EmptyState message="No customer dues." /> : null}
      {data.length > 0 ? (
        <DataTable
          headers={['Customer', 'Phone', 'Due', '']}
          rows={data.map((r) => [
            r.name,
            r.phone || '—',
            formatBDT(r.due),
            <PermissionGate key={r.id} permission={['customer_due.collect', 'accounts.manage', 'accounts.post', 'sales.read']}>
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setSelected(r)
                  setAmount(String(r.due))
                }}
              >
                Collect
              </Button>
            </PermissionGate>,
          ])}
        />
      ) : null}

      <Dialog open={Boolean(selected)} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Collect due — {selected?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-[#6B7280]">Outstanding {formatBDT(selected?.due ?? 0)}</p>
            <div className="space-y-1">
              <Label>Amount</Label>
              <Input type="number" min={0.01} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Method</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                {(payMethods.length ? payMethods : [{ code: 'cash', name: 'Cash' }]).map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Receive account</Label>
              {resolved ? (
                <div className="flex h-9 items-center rounded-md border border-border bg-[#F9FAFB] px-3 text-sm font-medium">
                  {resolved.account.name} ({formatBDT(resolved.account.current_balance)})
                </div>
              ) : (
                <p className="text-xs text-amber-700">{NO_PAYMENT_ACCOUNT_MESSAGE}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Reference</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" />
            </div>
            <Button
              className="w-full"
              disabled={collect.isPending || !resolved}
              onClick={() => collect.mutate()}
            >
              Collect
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
