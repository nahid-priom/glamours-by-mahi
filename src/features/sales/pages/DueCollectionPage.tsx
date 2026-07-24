import { useCallback, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { EntityCombobox } from '@/components/entity-combobox'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/features/auth/auth-session'
import { simpleAccountingRepository } from '@/features/accounting/repositories/simple-accounting.repository'
import { queryKeys } from '@/lib/query/keys'
import { formatBDT } from '@/lib/format'
import { friendlyRpcError } from '@/lib/errors/rpc-error'
import { invalidateCustomerCollectionCaches } from '@/lib/mutations/party-finance-cache'
import {
  collectDue,
  listPaymentMethods,
  searchCustomers,
} from '../repositories/sales.repository'

export function DueCollectionPage() {
  const { activeBranchId } = useAuth()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [accountId, setAccountId] = useState<string | null>(null)
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const clientTxnKeyRef = useRef(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `col-${Date.now()}`,
  )

  const onSearchCustomers = useCallback((q: string) => searchCustomers(q), [])

  const { data: methods = [] } = useQuery({
    queryKey: queryKeys.paymentMethods,
    queryFn: listPaymentMethods,
  })

  const { data: accounts = [] } = useQuery({
    queryKey: [...queryKeys.accounts, 'fa', activeBranchId],
    queryFn: () => simpleAccountingRepository.listFinancialAccounts(activeBranchId),
  })

  const activeAccounts = accounts.filter((a) => a.is_active)

  const mutation = useMutation({
    mutationFn: async () => {
      if (!customerId) throw new Error('Select a customer')
      const amt = Number(amount)
      if (!amt || amt <= 0) throw new Error('Enter a valid amount')
      const selected = methods.find((m) => m.code === method)
      const receiveAccountId =
        accountId ?? selected?.financial_account_id ?? activeAccounts[0]?.id ?? null
      if (!receiveAccountId) throw new Error('Select a receive account')
      return collectDue({
        customer_id: customerId,
        amount: amt,
        payment_method: method,
        financial_account_id: receiveAccountId,
        branch_id: activeBranchId,
        note: note || null,
        reference: reference || null,
        client_txn_key: clientTxnKeyRef.current,
      })
    },
    onSuccess: async (_data, _vars, _ctx) => {
      await invalidateCustomerCollectionCaches(qc, {
        customerId,
        branchId: activeBranchId,
      })
      toast(`Collection received — ${formatBDT(Number(amount))}`)
      setAmount('')
      setReference('')
      setNote('')
      clientTxnKeyRef.current =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `col-${Date.now()}`
    },
    onError: (e: Error) => toast(friendlyRpcError(e), 'error'),
  })

  return (
    <div className="mx-auto w-full max-w-lg min-w-0 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#111827]">Due Collection</h1>
        <p className="text-sm text-[#6B7280]">
          Collect money a customer owes and update the receive account balance.
        </p>
      </div>

      <PermissionGate permission={['customer_due.collect', 'accounts.post', 'accounts.manage']}>
        <div className="space-y-3 rounded-xl border border-border bg-white p-4">
          <div className="space-y-1.5">
            <Label>Customer</Label>
            <EntityCombobox
              value={customerId}
              onChange={(id) => setCustomerId(id)}
              onSearch={onSearchCustomers}
              placeholder="Search customer"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="due-amount">Amount</Label>
            <Input
              id="due-amount"
              type="number"
              min={0.01}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Payment method</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              {(methods.length
                ? methods.filter((m) => !('is_due' in m && m.is_due))
                : [{ code: 'cash', name: 'Cash' }]
              ).map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Receive account</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={accountId ?? ''}
              onChange={(e) => setAccountId(e.target.value || null)}
            >
              <option value="">Select account…</option>
              {activeAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({formatBDT(a.current_balance)})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="due-ref">Reference</Label>
            <Input
              id="due-ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Txn / cheque #"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="due-note">Note</Label>
            <Input id="due-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button className="w-full" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Collect due
          </Button>
        </div>
      </PermissionGate>
    </div>
  )
}
