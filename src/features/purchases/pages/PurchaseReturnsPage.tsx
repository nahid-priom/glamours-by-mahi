import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2 } from 'lucide-react'
import { purchasesRepository } from '../repositories/purchases.repository'
import {
  VoidPurchaseReturnDialog,
  type VoidPurchaseReturnMode,
} from '../components/VoidPurchaseReturnDialog'
import { simpleAccountingRepository } from '@/features/accounting/repositories/simple-accounting.repository'
import { formatBDT } from '@/lib/format'
import { queryKeys } from '@/lib/query/keys'
import { useAuth } from '@/features/auth/auth-session'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EntityCombobox } from '@/components/entity-combobox'
import { invalidatePurchaseCompletionCaches } from '@/lib/mutations/party-finance-cache'

type ReturnLine = {
  purchaseItemId: string
  variantId: string
  label: string
  maxQty: number
  unitCost: number
  qty: number
}

type EditPrefill = {
  purchaseId: string
  reason: string
  qtysByPurchaseItemId: Record<string, number>
}

export function PurchaseReturnsPage() {
  const { activeBranchId, profile } = useAuth()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [purchaseId, setPurchaseId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [lines, setLines] = useState<ReturnLine[]>([])
  const [refundAccountId, setRefundAccountId] = useState('')
  const editPrefillRef = useRef<EditPrefill | null>(null)
  const [voidTarget, setVoidTarget] = useState<{
    id: string
    returnNo: string
    mode: VoidPurchaseReturnMode
    supplierId: string
  } | null>(null)

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['purchase-returns'],
    queryFn: () => purchasesRepository.listPurchaseReturns(),
  })

  const { data: purchase, isLoading: loadingPurchase } = useQuery({
    queryKey: ['purchase-for-return', purchaseId],
    queryFn: () => purchasesRepository.getPurchase(purchaseId!),
    enabled: Boolean(purchaseId),
  })

  const { data: accounts = [] } = useQuery({
    queryKey: [...queryKeys.accounts, 'fa', activeBranchId],
    queryFn: () => simpleAccountingRepository.listFinancialAccounts(activeBranchId),
    enabled: Boolean(activeBranchId) && showForm,
  })

  const refundAccounts = useMemo(
    () =>
      accounts.filter(
        (a) => a.is_active && (a.account_kind === 'cash' || a.account_kind === 'bank'),
      ),
    [accounts],
  )

  useEffect(() => {
    if (!purchase?.purchase_items) return
    const prefill =
      editPrefillRef.current && editPrefillRef.current.purchaseId === purchase.id
        ? editPrefillRef.current
        : null
    setLines((prev) => {
      const prevQty = new Map(prev.map((l) => [l.purchaseItemId, l.qty]))
      return (
        purchase.purchase_items as Array<{
          id: string
          variant_id: string
          qty: number
          unit_cost: number
          product_variants: { sku: string; name: string; products: { name: string } }
        }>
      ).map((pi) => {
        const pv = pi.product_variants
        const prod = pv?.products?.name ?? ''
        const maxQty = Number(pi.qty)
        const qtyFromPrefill = prefill?.qtysByPurchaseItemId[pi.id]
        const qty =
          qtyFromPrefill != null
            ? qtyFromPrefill
            : (prevQty.get(pi.id) ?? 0)
        return {
          purchaseItemId: pi.id,
          variantId: pi.variant_id,
          label: `${prod} · ${pv?.name || pv?.sku}`,
          maxQty,
          unitCost: Number(pi.unit_cost) || 0,
          qty: Math.min(maxQty, Math.max(0, qty)),
        }
      })
    })
    setRefundAccountId('')
    if (prefill) {
      setReason(prefill.reason)
      editPrefillRef.current = null
    }
  }, [purchase])

  const returnTotal = useMemo(
    () => lines.reduce((sum, l) => sum + l.qty * l.unitCost, 0),
    [lines],
  )

  const purchaseDue = Number(purchase?.due_total ?? 0)
  const cashRefund = Math.max(0, returnTotal - purchaseDue)
  const needsRefundAccount = cashRefund > 0.0001

  const resetForm = () => {
    setShowForm(false)
    setPurchaseId(null)
    setLines([])
    setReason('')
    setRefundAccountId('')
    editPrefillRef.current = null
  }

  const createReturn = useMutation({
    mutationFn: async () => {
      if (!activeBranchId || !purchase || !profile?.organization_id) {
        throw new Error('Branch and purchase are required')
      }
      const items = lines.filter((l) => l.qty > 0)
      if (items.length === 0) throw new Error('Enter return quantities')
      if (needsRefundAccount && !refundAccountId) {
        throw new Error('Select a refund account for the cash refund due to the supplier')
      }
      return purchasesRepository.createPurchaseReturn({
        organization_id: profile.organization_id,
        branch_id: activeBranchId,
        purchase_id: purchase.id,
        supplier_id: purchase.supplier_id,
        reason: reason || undefined,
        refund_account_id: needsRefundAccount ? refundAccountId : undefined,
        items: items.map((l) => ({
          purchase_item_id: l.purchaseItemId,
          variant_id: l.variantId,
          qty: l.qty,
          unit_cost: l.unitCost,
        })),
      })
    },
    onSuccess: async () => {
      const supplierId = purchase?.supplier_id
      resetForm()
      await invalidatePurchaseCompletionCaches(qc, {
        supplierId,
        branchId: activeBranchId,
      })
      await qc.invalidateQueries({ queryKey: ['purchase-returns'] })
    },
  })

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">Purchase Returns</h1>
          <p className="text-sm text-[#6B7280]">Returns posted against supplier purchases.</p>
        </div>
        <PermissionGate permission="purchases.return">
          <Button
            size="sm"
            onClick={() => {
              if (showForm) resetForm()
              else setShowForm(true)
            }}
          >
            {showForm ? 'Cancel' : 'New return'}
          </Button>
        </PermissionGate>
      </div>

      {showForm ? (
        <div className="space-y-3 rounded-xl border border-border bg-white p-4">
          <label className="block text-sm font-medium">
            Purchase invoice
            <div className="mt-1">
              <EntityCombobox
                value={purchaseId}
                onChange={(id) => {
                  setPurchaseId(id)
                  setLines([])
                  setRefundAccountId('')
                  editPrefillRef.current = null
                }}
                onSearch={async (q) => {
                  const rows = await purchasesRepository.listPurchases(30)
                  return rows
                    .filter((p) => !q || p.invoice_no.toLowerCase().includes(q.toLowerCase()))
                    .map((p) => ({
                      id: p.id,
                      label: p.invoice_no,
                      description: `${(p.suppliers as { name: string } | null)?.name ?? 'Supplier'} · ${formatBDT(Number(p.grand_total))}`,
                    }))
                }}
                placeholder="Search purchase invoices…"
              />
            </div>
          </label>

          {loadingPurchase ? <p className="text-sm text-[#6B7280]">Loading purchase…</p> : null}

          {lines.length > 0 ? (
            <div className="space-y-2">
              {lines.map((l) => (
                <div key={l.purchaseItemId} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1">{l.label}</span>
                  <span className="text-[#6B7280]">max {l.maxQty}</span>
                  <Input
                    type="number"
                    min={0}
                    max={l.maxQty}
                    className="h-8 w-24"
                    value={l.qty || ''}
                    onChange={(e) => {
                      const qty = Math.min(l.maxQty, Math.max(0, Number(e.target.value) || 0))
                      setLines((prev) =>
                        prev.map((x) => (x.purchaseItemId === l.purchaseItemId ? { ...x, qty } : x)),
                      )
                    }}
                  />
                </div>
              ))}

              <div className="rounded-lg border border-border bg-[#F9FAFB] px-3 py-2 text-sm text-[#111827]">
                <p>
                  Return total: <span className="font-semibold tabular-nums">{formatBDT(returnTotal)}</span>
                </p>
                <p className="text-[#6B7280]">
                  Purchase due remaining: {formatBDT(purchaseDue)}
                  {needsRefundAccount
                    ? ` · Cash refund due: ${formatBDT(cashRefund)}`
                    : ' · Covered by purchase due (no cash refund)'}
                </p>
              </div>

              {needsRefundAccount ? (
                <label className="block text-sm font-medium">
                  Refund account
                  <select
                    className="mt-1 flex h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                    value={refundAccountId}
                    onChange={(e) => setRefundAccountId(e.target.value)}
                  >
                    <option value="">Select cash/bank account…</option>
                    {refundAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.account_kind}) · {formatBDT(a.current_balance)}
                      </option>
                    ))}
                  </select>
                  {refundAccounts.length === 0 ? (
                    <p className="mt-1 text-xs text-[#6B7280]">
                      No active cash/bank accounts for this branch.
                    </p>
                  ) : null}
                </label>
              ) : null}

              <Input
                placeholder="Reason (optional)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <Button
                size="sm"
                disabled={
                  createReturn.isPending || (needsRefundAccount && !refundAccountId)
                }
                onClick={() => createReturn.mutate()}
              >
                Post return
              </Button>
              {createReturn.error ? (
                <p className="text-sm text-[#E11D48]">{(createReturn.error as Error).message}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {isLoading ? <p className="text-sm text-[#6B7280]">Loading…</p> : null}
      {error ? <p className="text-sm text-[#E11D48]">Could not load returns.</p> : null}
      {!isLoading && data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white p-8 text-center text-sm text-[#6B7280]">
          No purchase returns yet.
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
            <tr>
              <th className="px-3 py-2 text-left">Return #</th>
              <th className="px-3 py-2 text-left">Supplier</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Total</th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => {
              const s = r.suppliers as unknown as { name: string } | null
              const canAct = r.status === 'completed'
              return (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-3 py-2">{r.return_no}</td>
                  <td className="px-3 py-2">{s?.name || '—'}</td>
                  <td className="px-3 py-2">{r.status}</td>
                  <td className="px-3 py-2">{formatBDT(Number(r.total))}</td>
                  <td className="px-3 py-2">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="px-3 py-2">
                    {canAct ? (
                      <PermissionGate permission="purchases.return">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            aria-label={`Edit ${r.return_no}`}
                            onClick={() =>
                              setVoidTarget({
                                id: r.id,
                                returnNo: r.return_no,
                                mode: 'edit',
                                supplierId: r.supplier_id,
                              })
                            }
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-[#E11D48]"
                            aria-label={`Void ${r.return_no}`}
                            onClick={() =>
                              setVoidTarget({
                                id: r.id,
                                returnNo: r.return_no,
                                mode: 'delete',
                                supplierId: r.supplier_id,
                              })
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </PermissionGate>
                    ) : (
                      <span className="block text-right text-xs text-[#9CA3AF]">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {voidTarget ? (
        <VoidPurchaseReturnDialog
          returnId={voidTarget.id}
          returnNo={voidTarget.returnNo}
          mode={voidTarget.mode}
          open={Boolean(voidTarget)}
          onOpenChange={(open) => {
            if (!open) setVoidTarget(null)
          }}
          onVoided={async (ctx) => {
            await invalidatePurchaseCompletionCaches(qc, {
              supplierId: voidTarget.supplierId,
              branchId: activeBranchId,
            })
            await qc.invalidateQueries({ queryKey: ['purchase-returns'] })
            await qc.invalidateQueries({ queryKey: ['purchase-for-return', ctx.purchaseId] })

            if (ctx.mode === 'edit') {
              const qtysByPurchaseItemId: Record<string, number> = {}
              for (const item of ctx.items) {
                if (item.purchase_item_id) {
                  qtysByPurchaseItemId[item.purchase_item_id] = item.qty
                }
              }
              editPrefillRef.current = {
                purchaseId: ctx.purchaseId,
                reason: ctx.reason,
                qtysByPurchaseItemId,
              }
              setPurchaseId(ctx.purchaseId)
              setShowForm(true)
            }
            setVoidTarget(null)
          }}
        />
      ) : null}
    </div>
  )
}
