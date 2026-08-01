import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { purchasesRepository } from '../repositories/purchases.repository'
import { getSupplier, listSupplierLedger } from '@/features/suppliers/repositories/suppliers.repository'
import { EntityCombobox } from '@/components/entity-combobox'
import { useAuth } from '@/features/auth/auth-session'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { formatBDT } from '@/lib/format'
import { friendlyRpcError } from '@/lib/errors/rpc-error'
import { invalidateSupplierPaymentCaches } from '@/lib/mutations/party-finance-cache'
import { supabase } from '@/lib/supabase/client'

const paymentSchema = z.object({
  supplierId: z.string().uuid('Select a supplier'),
  amount: z.number().positive('Amount must be greater than zero'),
  financialAccountId: z.string().uuid('Select a payment account'),
  method: z.enum(['cash', 'bank', 'mobile']),
})

export function SupplierPaymentsPage() {
  const { activeBranchId } = useAuth()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [amount, setAmount] = useState(0)
  const [method, setMethod] = useState<'cash' | 'bank' | 'mobile'>('cash')
  const [financialAccountId, setFinancialAccountId] = useState<string | null>(null)
  const [reference, setReference] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
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

  const { data: supplier } = useQuery({
    queryKey: ['supplier-pay-context', supplierId],
    queryFn: () => getSupplier(supplierId!),
    enabled: Boolean(supplierId),
  })

  const { data: ledger = [] } = useQuery({
    queryKey: ['supplier-pay-ledger', supplierId],
    queryFn: () => listSupplierLedger(supplierId!),
    enabled: Boolean(supplierId),
  })

  const { data: openPurchases = [] } = useQuery({
    queryKey: ['supplier-open-purchases', supplierId],
    queryFn: async () => {
      const { data, error: qErr } = await supabase
        .from('purchases')
        .select('id, invoice_no, grand_total, paid_total, due_total, created_at')
        .eq('supplier_id', supplierId!)
        .eq('status', 'completed')
        .gt('due_total', 0)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(10)
      if (qErr) throw qErr
      return data ?? []
    },
    enabled: Boolean(supplierId),
  })

  const selectedAccount = accounts.find((a) => a.id === financialAccountId)
  const estimatedBalanceAfter = selectedAccount
    ? Number(selectedAccount.current_balance) - amount
    : null

  const validation = useMemo(() => {
    const parsed = paymentSchema.safeParse({
      supplierId,
      amount,
      financialAccountId,
      method,
    })
    return parsed
  }, [supplierId, amount, financialAccountId, method])

  const pay = useMutation({
    mutationFn: () => {
      const parsed = paymentSchema.parse({
        supplierId,
        amount,
        financialAccountId,
        method,
      })
      return purchasesRepository.paySupplier({
        supplier_id: parsed.supplierId,
        branch_id: activeBranchId,
        amount: parsed.amount,
        method: parsed.method,
        financial_account_id: parsed.financialAccountId,
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
      setConfirmOpen(false)
      clientTxnKeyRef.current =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `spay-${Date.now()}`
    },
    onError: (e: Error) => toast(friendlyRpcError(e), 'error'),
  })

  function handleSubmit() {
    if (!validation.success) {
      toast(validation.error.issues[0]?.message ?? 'Invalid payment', 'error')
      return
    }
    if (supplier && amount > Number(supplier.current_due) + 0.01) {
      toast('Amount exceeds current supplier due', 'error')
      return
    }
    setConfirmOpen(true)
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#111827]">Supplier Payment</h1>
        <p className="text-sm text-[#6B7280]">Pay what you owe a supplier from cash, bank, or mobile money.</p>
      </div>

      <PermissionGate permission={['supplier_due.pay', 'accounts.post', 'purchases.create', 'accounts.manage']}>
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="grid gap-2 rounded-xl border border-border bg-white p-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Supplier</Label>
              <EntityCombobox
                value={supplierId}
                onChange={(id) => {
                  setSupplierId(id)
                  setConfirmOpen(false)
                }}
                onSearch={purchasesRepository.searchSuppliers}
                placeholder="Select supplier…"
              />
            </div>
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                placeholder="Amount"
                value={amount || ''}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>Method</Label>
              <select
                className="flex h-9 w-full rounded-md border border-border bg-white px-2 text-sm"
                value={method}
                onChange={(e) => setMethod(e.target.value as 'cash' | 'bank' | 'mobile')}
              >
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="mobile">Mobile money</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label>Payment account</Label>
              <select
                className="flex h-9 w-full rounded-md border border-border bg-white px-2 text-sm"
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
            </div>
            <div className="sm:col-span-2">
              <Label>Reference</Label>
              <Input
                placeholder="Cheque / txn reference (optional)"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
            <Button disabled={pay.isPending} onClick={handleSubmit} className="sm:col-span-2">
              {pay.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Review payment
            </Button>
          </div>

          {supplier ? (
            <aside className="space-y-3 rounded-xl border border-border bg-[#F9FAFB] p-4 text-sm">
              <h2 className="font-semibold text-[#111827]">{supplier.name}</h2>
              <dl className="space-y-2">
                <div className="flex justify-between gap-2">
                  <dt className="text-[#6B7280]">Current due</dt>
                  <dd className="font-medium">{formatBDT(Number(supplier.current_due))}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[#6B7280]">Advance</dt>
                  <dd className="font-medium">
                    {formatBDT(Number((supplier as { current_advance?: number }).current_advance ?? 0))}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[#6B7280]">Total purchased</dt>
                  <dd className="font-medium">—</dd>
                </div>
                {selectedAccount ? (
                  <>
                    <div className="flex justify-between gap-2 border-t pt-2">
                      <dt className="text-[#6B7280]">Account balance</dt>
                      <dd className="font-medium">{formatBDT(Number(selectedAccount.current_balance))}</dd>
                    </div>
                    {amount > 0 ? (
                      <div className="flex justify-between gap-2">
                        <dt className="text-[#6B7280]">After payment</dt>
                        <dd className="font-medium">{formatBDT(estimatedBalanceAfter ?? 0)}</dd>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </dl>
              {openPurchases.length > 0 ? (
                <div>
                  <p className="mb-1 text-xs font-medium uppercase text-[#6B7280]">Open invoices</p>
                  <ul className="space-y-1 text-xs">
                    {openPurchases.map((p) => (
                      <li key={p.id} className="flex justify-between gap-2">
                        <span>{p.invoice_no}</span>
                        <span>{formatBDT(Number(p.due_total))}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {ledger.length > 0 ? (
                <p className="text-xs text-[#6B7280]">
                  Latest ledger: {ledger[0]?.entry_type} · {formatBDT(Number(ledger[0]?.balance_after))}
                </p>
              ) : null}
            </aside>
          ) : (
            <aside className="rounded-xl border border-dashed border-border p-4 text-sm text-[#6B7280]">
              Select a supplier to see due balance, open invoices, and account impact.
            </aside>
          )}
        </div>

        {confirmOpen && validation.success ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
            <p className="font-medium text-[#111827]">Confirm supplier payment</p>
            <p className="mt-1 text-[#6B7280]">
              Pay {formatBDT(amount)} to {supplier?.name} from {selectedAccount?.name}?
            </p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" disabled={pay.isPending} onClick={() => pay.mutate()}>
                {pay.isPending ? 'Processing…' : 'Confirm & pay'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
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
