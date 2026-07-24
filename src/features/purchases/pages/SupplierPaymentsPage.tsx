import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { purchasesRepository } from '../repositories/purchases.repository'
import { EntityCombobox } from '@/components/entity-combobox'
import { useAuth } from '@/features/auth/auth-session'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { formatBDT } from '@/lib/format'
import { friendlyRpcError } from '@/lib/errors/rpc-error'
import { invalidateSupplierPaymentCaches } from '@/lib/mutations/party-finance-cache'

export function SupplierPaymentsPage() {
  const { activeBranchId } = useAuth()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [amount, setAmount] = useState(0)
  const [method, setMethod] = useState('cash')
  const [financialAccountId, setFinancialAccountId] = useState<string | null>(null)
  const [reference, setReference] = useState('')
  const clientTxnKeyRef = useRef(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `spay-${Date.now()}`,
  )

  const { data: payments = [], isLoading, error } = useQuery({
    queryKey: ['supplier-payments'],
    queryFn: () => purchasesRepository.listSupplierPayments(),
  })
  const { data: accounts = [] } = useQuery({
    queryKey: ['purchase-fa'],
    queryFn: () => purchasesRepository.listFinancialAccounts(),
  })

  const pay = useMutation({
    mutationFn: () => {
      if (!supplierId || amount <= 0) throw new Error('Supplier and amount required')
      if (!financialAccountId) throw new Error('Select a payment account')
      return purchasesRepository.paySupplier({
        supplier_id: supplierId,
        branch_id: activeBranchId,
        amount,
        method,
        financial_account_id: financialAccountId,
        reference: reference || null,
        client_txn_key: clientTxnKeyRef.current,
      })
    },
    onSuccess: async () => {
      await invalidateSupplierPaymentCaches(qc, {
        supplierId,
        branchId: activeBranchId,
      })
      toast(`Supplier payment completed — ${formatBDT(amount)}`)
      setAmount(0)
      setReference('')
      clientTxnKeyRef.current =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `spay-${Date.now()}`
    },
    onError: (e: Error) => toast(friendlyRpcError(e), 'error'),
  })

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#111827]">Supplier Payment</h1>
        <p className="text-sm text-[#6B7280]">Pay what you owe a supplier from cash, bank, or mobile money.</p>
      </div>

      <PermissionGate permission={['supplier_due.pay', 'accounts.post', 'purchases.create', 'accounts.manage']}>
        <div className="grid gap-2 rounded-xl border border-border bg-white p-4 sm:grid-cols-2">
          <EntityCombobox
            value={supplierId}
            onChange={(id) => setSupplierId(id)}
            onSearch={purchasesRepository.searchSuppliers}
            placeholder="Select supplier…"
          />
          <Input
            type="number"
            placeholder="Amount"
            value={amount || ''}
            onChange={(e) => setAmount(Number(e.target.value) || 0)}
          />
          <select
            className="h-9 rounded-md border border-border bg-white px-2 text-sm"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            <option value="cash">Cash</option>
            <option value="bank">Bank</option>
          </select>
          <select
            className="h-9 rounded-md border border-border bg-white px-2 text-sm"
            value={financialAccountId ?? ''}
            onChange={(e) => setFinancialAccountId(e.target.value || null)}
          >
            <option value="">Financial account…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({formatBDT(Number(a.current_balance))})
              </option>
            ))}
          </select>
          <Input
            placeholder="Reference"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className="sm:col-span-2"
          />
          <Button disabled={pay.isPending} onClick={() => pay.mutate()} className="sm:col-span-2">
            {pay.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            {pay.isPending ? 'Paying…' : 'Record payment'}
          </Button>
          {pay.error ? (
            <p className="text-sm text-[#E11D48] sm:col-span-2">
              {pay.error instanceof Error ? pay.error.message : 'Failed'}
            </p>
          ) : null}
        </div>
      </PermissionGate>

      {isLoading ? <p className="text-sm text-[#6B7280]">Loading…</p> : null}
      {error ? <p className="text-sm text-[#E11D48]">Could not load payments.</p> : null}

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
            <tr>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Invoice</th>
              <th className="px-3 py-2 text-left">Supplier</th>
              <th className="px-3 py-2 text-left">Method</th>
              <th className="px-3 py-2 text-left">Amount</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => {
              const purchase = p.purchases as unknown as {
                invoice_no: string
                suppliers: { name: string } | null
              } | null
              return (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="px-3 py-2">{new Date(p.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2">{purchase?.invoice_no || '—'}</td>
                  <td className="px-3 py-2">{purchase?.suppliers?.name || '—'}</td>
                  <td className="px-3 py-2">{p.method}</td>
                  <td className="px-3 py-2">{formatBDT(Number(p.amount))}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
