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
import { invalidateSupplierPaymentCaches } from '@/lib/mutations/party-finance-cache'
import { listPaymentMethods } from '@/features/sales/repositories/sales.repository'
import { toastRpcError } from '@/lib/errors/rpc-error'
import { ResolvedPaymentAccountField } from '@/components/payments/ResolvedPaymentAccountField'
import {
  missingPaymentAccountMessage,
  resolvePaymentAccount,
} from '@/lib/payments/resolve-payment-account'

export function SupplierDuePage() {
  const { activeBranchId, profile } = useAuth()
  const qc = useQueryClient()
  const { toast } = useToast()
  const [selected, setSelected] = useState<{ id: string; name: string; due: number } | null>(null)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')

  const { data = [], isLoading, error } = useQuery({
    queryKey: [...queryKeys.accounts, 'supplier-dues'],
    queryFn: () => simpleAccountingRepository.listSupplierDues(),
  })

  const { data: accounts = [] } = useQuery({
    queryKey: [...queryKeys.accounts, 'fa', activeBranchId],
    queryFn: () => simpleAccountingRepository.listFinancialAccounts(activeBranchId),
  })

  const { data: methods = [] } = useQuery({
    queryKey: queryKeys.paymentMethods,
    queryFn: listPaymentMethods,
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

  const pay = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('Select a supplier')
      if (!activeBranchId) throw new Error('Select an active branch first')
      const amt = Number(amount)
      if (!amt || amt <= 0) throw new Error('Enter a valid amount')
      const fa = resolved?.account.id ?? null
      if (!fa) throw new Error(missingPaymentAccountMessage(method))
      return simpleAccountingRepository.paySupplier({
        supplier_id: selected.id,
        amount: amt,
        method,
        financial_account_id: fa,
        branch_id: activeBranchId,
        reference: reference || null,
      })
    },
    onSuccess: async () => {
      toast('Payment recorded')
      const supplierId = selected?.id
      setSelected(null)
      setAmount('')
      setReference('')
      await invalidateSupplierPaymentCaches(qc, {
        supplierId,
        branchId: activeBranchId,
      })
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 space-y-4">
      <PageHeader title="Supplier Due" subtitle="What you still owe suppliers." />
      <KpiCard label="Total due" value={formatBDT(totalDue)} />

      {isLoading ? <Skeleton className="h-40" /> : null}
      <ErrorText error={error} />
      {!isLoading && data.length === 0 ? <EmptyState message="No supplier dues." /> : null}
      {data.length > 0 ? (
        <DataTable
          headers={['Supplier', 'Phone', 'Due', '']}
          rows={data.map((r) => [
            r.name,
            r.phone || '—',
            formatBDT(r.due),
            <PermissionGate
              key={r.id}
              permission={['supplier_due.pay', 'accounts.manage', 'accounts.post', 'purchases.create']}
            >
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setSelected(r)
                  setAmount(String(r.due))
                }}
              >
                Pay
              </Button>
            </PermissionGate>,
          ])}
        />
      ) : null}

      <Dialog open={Boolean(selected)} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pay supplier — {selected?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-[#6B7280]">Outstanding {formatBDT(selected?.due ?? 0)}</p>
            <div className="space-y-1">
              <Label>Amount</Label>
              <Input
                type="number"
                min={0.01}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Payment method</Label>
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
            <ResolvedPaymentAccountField
              label="Payment account"
              resolved={resolved}
              methodCode={method}
              branchId={activeBranchId}
            />
            <div className="space-y-1">
              <Label>Reference</Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <Button className="w-full" disabled={pay.isPending || !resolved} onClick={() => pay.mutate()}>
              Pay
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
