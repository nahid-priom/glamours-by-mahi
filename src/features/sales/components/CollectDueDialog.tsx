import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/features/auth/auth-session'
import { simpleAccountingRepository } from '@/features/accounting/repositories/simple-accounting.repository'
import { formatBDT } from '@/lib/format'
import { friendlyRpcError } from '@/lib/errors/rpc-error'
import { invalidateCustomerCollectionCaches } from '@/lib/mutations/party-finance-cache'
import { queryKeys } from '@/lib/query/keys'
import { collectDue, listPaymentMethods } from '../repositories/sales.repository'

export type CollectDueTarget = {
  saleId: string
  customerId: string
  invoiceNo: string
  grandTotal: number
  paidTotal: number
  dueTotal: number
  branchId: string | null
}

export function CollectDueDialog({
  target,
  open,
  onOpenChange,
}: {
  target: CollectDueTarget | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { activeBranchId } = useAuth()
  const { toast } = useToast()
  const qc = useQueryClient()
  const clientTxnKeyRef = useRef(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `col-${Date.now()}`,
  )
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [accountId, setAccountId] = useState<string | null>(null)
  const [reference, setReference] = useState('')

  const branchId = target?.branchId ?? activeBranchId

  const { data: methods = [] } = useQuery({
    queryKey: queryKeys.paymentMethods,
    queryFn: listPaymentMethods,
  })

  const { data: accounts = [] } = useQuery({
    queryKey: [...queryKeys.accounts, 'fa', branchId],
    queryFn: () => simpleAccountingRepository.listFinancialAccounts(branchId),
    enabled: open,
  })

  const activeAccounts = accounts.filter((a) => a.is_active)

  useEffect(() => {
    if (open && target) {
      setAmount(String(target.dueTotal))
      setReference('')
    }
  }, [open, target])

  const mutation = useMutation({
    mutationFn: async () => {
      if (!target) throw new Error('No invoice selected')
      const amt = Number(amount)
      if (!amt || amt <= 0) throw new Error('Enter a valid amount')
      if (amt > target.dueTotal) throw new Error('Amount cannot exceed the current due')
      const selected = methods.find((m) => m.code === method)
      const receiveAccountId =
        accountId ?? selected?.financial_account_id ?? activeAccounts[0]?.id ?? null
      if (!receiveAccountId) throw new Error('Select a receive account')
      return collectDue({
        customer_id: target.customerId,
        amount: amt,
        payment_method: method,
        financial_account_id: receiveAccountId,
        branch_id: branchId,
        note: `Collection for ${target.invoiceNo}`,
        reference: reference || null,
        client_txn_key: clientTxnKeyRef.current,
      })
    },
    onSuccess: async () => {
      await invalidateCustomerCollectionCaches(qc, {
        customerId: target?.customerId,
        saleId: target?.saleId,
        branchId,
      })
      toast(`Collection received — ${formatBDT(Number(amount))} for ${target?.invoiceNo ?? 'invoice'}`)
      clientTxnKeyRef.current =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `col-${Date.now()}`
      onOpenChange(false)
    },
    onError: (e: Error) => toast(friendlyRpcError(e), 'error'),
  })

  const payableMethods = methods.length
    ? methods.filter((m) => !('is_due' in m && m.is_due))
    : [{ code: 'cash', name: 'Cash' }]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Collect Due{target ? ` · ${target.invoiceNo}` : ''}</DialogTitle>
        </DialogHeader>
        {target ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-surface-soft p-3 text-center text-sm">
              <div>
                <p className="text-[11px] text-text-muted">Total</p>
                <p className="font-semibold tabular-nums">{formatBDT(target.grandTotal)}</p>
              </div>
              <div>
                <p className="text-[11px] text-text-muted">Paid</p>
                <p className="font-semibold tabular-nums text-success">
                  {formatBDT(target.paidTotal)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-text-muted">Due</p>
                <p className="font-semibold tabular-nums text-danger">
                  {formatBDT(target.dueTotal)}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="collect-amount">Amount</Label>
              <Input
                id="collect-amount"
                type="number"
                min={0.01}
                max={target.dueTotal}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label>Payment Method</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                {payableMethods.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Receiving Account</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={accountId ?? ''}
                onChange={(e) => setAccountId(e.target.value || null)}
              >
                <option value="">Auto Select</option>
                {activeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({formatBDT(a.current_balance)})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="collect-ref">Reference (Optional)</Label>
              <Input
                id="collect-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Txn / cheque #"
              />
            </div>

            <Button
              className="w-full"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Collect Payment
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
