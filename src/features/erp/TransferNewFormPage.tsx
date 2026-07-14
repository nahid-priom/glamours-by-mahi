import { useState } from 'react'
import { peekDatabase, TransactionError } from '@/database/transaction'
import { inventoryService } from '@/services/inventory.service'
import { useAuth } from '@/features/auth/auth.context'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ModuleShell } from './ErpModulePages'
import { useNavigate } from 'react-router-dom'

export function TransferNewFormPage() {
  const db = peekDatabase()
  const { session } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [fromBranchId, setFrom] = useState(db.branches[0]?.id ?? '')
  const [toBranchId, setTo] = useState(db.branches[1]?.id ?? db.branches[0]?.id ?? '')
  const [productId, setProductId] = useState(db.products[0]?.id ?? '')
  const [quantity, setQuantity] = useState(1)
  const [saving, setSaving] = useState(false)

  const save = () => {
    if (saving) return
    setSaving(true)
    try {
      const transfer = inventoryService.createTransfer({
        fromBranchId,
        toBranchId,
        items: [{ productId, quantity }],
        idempotencyKey: `tr_${Date.now()}_${session.userId}`,
        userName: session.name,
      })
      inventoryService.dispatch(transfer.id, session.name)
      toast('Stock transfer dispatched')
      navigate('/inventory/transfers')
    } catch (err) {
      toast(err instanceof TransactionError ? err.message : 'Transfer failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModuleShell title="New Stock Transfer" subtitle="Source stock decreases at dispatch">
      <div className="mx-auto max-w-lg space-y-3 rounded-2xl border bg-white p-4">
        <label className="text-xs font-medium text-[#6B7280]">From Branch</label>
        <select className="w-full rounded-xl border px-3 py-2 text-sm" value={fromBranchId} onChange={(e) => setFrom(e.target.value)}>
          {db.branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <label className="text-xs font-medium text-[#6B7280]">To Branch</label>
        <select className="w-full rounded-xl border px-3 py-2 text-sm" value={toBranchId} onChange={(e) => setTo(e.target.value)}>
          {db.branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <label className="text-xs font-medium text-[#6B7280]">Product</label>
        <select className="w-full rounded-xl border px-3 py-2 text-sm" value={productId} onChange={(e) => setProductId(e.target.value)}>
          {db.products.slice(0, 80).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <label className="text-xs font-medium text-[#6B7280]">Quantity</label>
        <Input type="number" value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))} />
        <Button className="w-full rounded-full" disabled={saving} onClick={save}>
          {saving ? 'Saving…' : 'Request & Dispatch Transfer'}
        </Button>
      </div>
    </ModuleShell>
  )
}
