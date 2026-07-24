import { useState } from 'react'
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

export function SupplierDuePage() {
  const { activeBranchId } = useAuth()
  const qc = useQueryClient()
  const { toast } = useToast()
  const [selected, setSelected] = useState<{ id: string; name: string; due: number } | null>(null)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [accountId, setAccountId] = useState<string | null>(null)
  const [reference, setReference] = useState('')

  const { data = [], isLoading, error } = useQuery({
    queryKey: [...queryKeys.accounts, 'supplier-dues'],
    queryFn: () => simpleAccountingRepository.listSupplierDues(),
  })

  const { data: accounts = [] } = useQuery({
    queryKey: [...queryKeys.accounts, 'fa', activeBranchId],
    queryFn: () => simpleAccountingRepository.listFinancialAccounts(activeBranchId),
  })

  const totalDue = data.reduce((s, r) => s + r.due, 0)

  const pay = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('Select a supplier')
      const amt = Number(amount)
      if (!amt || amt <= 0) throw new Error('Enter a valid amount')
      const fa = accountId || accounts.find((a) => a.is_active)?.id
      if (!fa) throw new Error('Select a cash/bank account')
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
    onError: (e: Error) => toast(e.message, 'error'),
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
            <PermissionGate key={r.id} permission={['supplier_due.pay', 'accounts.manage', 'accounts.post', 'purchases.create']}>
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setSelected(r)
                  setAmount(String(r.due))
                  setAccountId(accounts.find((a) => a.is_active)?.id ?? null)
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
              <Input type="number" min={0.01} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Method</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="mobile_money">Mobile money</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>From account</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={accountId ?? ''}
                onChange={(e) => setAccountId(e.target.value || null)}
              >
                {accounts
                  .filter((a) => a.is_active)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatBDT(a.current_balance)})
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Reference</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" />
            </div>
            <Button className="w-full" disabled={pay.isPending} onClick={() => pay.mutate()}>
              Pay
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
