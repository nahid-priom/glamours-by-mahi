import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { purchasesRepository } from '../repositories/purchases.repository'
import { formatBDT } from '@/lib/format'
import { useAuth } from '@/features/auth/auth-session'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EntityCombobox } from '@/components/entity-combobox'

type ReturnLine = { purchaseItemId: string; variantId: string; label: string; maxQty: number; qty: number }

export function PurchaseReturnsPage() {
  const { activeBranchId, profile } = useAuth()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [purchaseId, setPurchaseId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [lines, setLines] = useState<ReturnLine[]>([])

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['purchase-returns'],
    queryFn: () => purchasesRepository.listPurchaseReturns(),
  })

  const { data: purchase, isLoading: loadingPurchase } = useQuery({
    queryKey: ['purchase-for-return', purchaseId],
    queryFn: () => purchasesRepository.getPurchase(purchaseId!),
    enabled: Boolean(purchaseId),
  })

  useEffect(() => {
    if (!purchase?.purchase_items) return
    setLines(
      (purchase.purchase_items as Array<{
        id: string
        variant_id: string
        qty: number
        product_variants: { sku: string; name: string; products: { name: string } }
      }>).map((pi) => {
        const pv = pi.product_variants
        const prod = pv?.products?.name ?? ''
        return {
          purchaseItemId: pi.id,
          variantId: pi.variant_id,
          label: `${prod} · ${pv?.name || pv?.sku}`,
          maxQty: Number(pi.qty),
          qty: 0,
        }
      }),
    )
  }, [purchase])

  const createReturn = useMutation({
    mutationFn: async () => {
      if (!activeBranchId || !purchase || !profile?.organization_id) {
        throw new Error('Branch and purchase are required')
      }
      const items = lines.filter((l) => l.qty > 0)
      if (items.length === 0) throw new Error('Enter return quantities')
      return purchasesRepository.createPurchaseReturn({
        organization_id: profile.organization_id,
        branch_id: activeBranchId,
        purchase_id: purchase.id,
        supplier_id: purchase.supplier_id,
        reason: reason || undefined,
        items: items.map((l) => ({
          purchase_item_id: l.purchaseItemId,
          variant_id: l.variantId,
          qty: l.qty,
          unit_cost: 0,
        })),
      })
    },
    onSuccess: async () => {
      setShowForm(false)
      setPurchaseId(null)
      setLines([])
      setReason('')
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
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
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
              <Input
                placeholder="Reason (optional)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <Button
                size="sm"
                disabled={createReturn.isPending}
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
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
            <tr>
              <th className="px-3 py-2 text-left">Return #</th>
              <th className="px-3 py-2 text-left">Supplier</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Total</th>
              <th className="px-3 py-2 text-left">Date</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => {
              const s = r.suppliers as unknown as { name: string } | null
              return (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-3 py-2">{r.return_no}</td>
                  <td className="px-3 py-2">{s?.name || '—'}</td>
                  <td className="px-3 py-2">{r.status}</td>
                  <td className="px-3 py-2">{formatBDT(Number(r.total))}</td>
                  <td className="px-3 py-2">{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
