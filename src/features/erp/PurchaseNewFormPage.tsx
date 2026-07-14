import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { peekDatabase } from '@/database/transaction'
import { purchasesService } from '@/services/purchases.service'
import { formatBDT } from '@/lib/format'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/features/auth/auth.context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ModuleShell } from '@/features/erp/ErpModulePages'
import { TransactionError } from '@/database/transaction'

interface Line {
  productId: string
  name: string
  quantity: number
  unitCost: number
  discount: number
}

export function PurchaseNewFormPage() {
  const db = peekDatabase()
  const { session } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [supplierId, setSupplierId] = useState(db.suppliers[0]?.id ?? '')
  const [branchId, setBranchId] = useState(session.branchId ?? db.branches[0]?.id ?? '')
  const [accountId, setAccountId] = useState(db.financialAccounts[0]?.id ?? '')
  const [transportCost, setTransportCost] = useState(0)
  const [paidAmount, setPaidAmount] = useState(0)
  const [search, setSearch] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [saving, setSaving] = useState(false)

  const products = useMemo(() => {
    const q = search.trim().toLowerCase()
    return db.products
      .filter((p) => !p.deleted_at && p.status === 'active')
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .slice(0, 30)
  }, [db.products, search])

  const subtotal = lines.reduce((s, l) => s + l.unitCost * l.quantity, 0)
  const discount = lines.reduce((s, l) => s + l.discount, 0)
  const total = subtotal - discount + transportCost

  const addProduct = (productId: string) => {
    const product = db.products.find((p) => p.id === productId)
    if (!product) return
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === productId)
      if (existing) {
        return prev.map((l) =>
          l.productId === productId ? { ...l, quantity: l.quantity + 1 } : l,
        )
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          quantity: 1,
          unitCost: product.cost,
          discount: 0,
        },
      ]
    })
  }

  const save = () => {
    if (saving) return
    setSaving(true)
    try {
      const purchase = purchasesService.create({
        supplierId,
        branchId,
        items: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitCost: l.unitCost,
          discount: l.discount,
        })),
        transportCost,
        paidAmount: Math.min(paidAmount, total),
        accountId: paidAmount > 0 ? accountId : null,
        idempotencyKey: `purchase_${Date.now()}_${session.userId}`,
        userName: session.name,
      })
      toast('Purchase saved successfully')
      navigate(`/purchases/${purchase.id}`)
    } catch (err) {
      toast(err instanceof TransactionError ? err.message : 'Could not save purchase', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModuleShell title="New Purchase" subtitle="Supplier → Branch → Products → Payment">
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3 rounded-2xl border bg-white p-4">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products to add…"
          />
          <div className="grid max-h-[360px] gap-2 overflow-y-auto sm:grid-cols-2">
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addProduct(p.id)}
                className="rounded-xl border px-3 py-2 text-left hover:border-[#E11D48]"
              >
                <p className="truncate text-sm font-medium">{p.name}</p>
                <p className="text-xs text-[#6B7280]">
                  {p.sku} · Cost {formatBDT(p.cost)}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border bg-white p-4">
          <label className="block text-xs font-medium text-[#6B7280]">Supplier</label>
          <select
            className="w-full rounded-xl border px-3 py-2 text-sm"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
          >
            {db.suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <label className="block text-xs font-medium text-[#6B7280]">Branch / Warehouse</label>
          <select
            className="w-full rounded-xl border px-3 py-2 text-sm"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          >
            {db.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <div className="space-y-2">
            {lines.map((l) => (
              <div key={l.productId} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{l.name}</p>
                  <p className="text-xs text-[#6B7280]">
                    Qty {l.quantity} × {formatBDT(l.unitCost)}
                  </p>
                </div>
                <Input
                  type="number"
                  className="w-20"
                  value={l.quantity}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((x) =>
                        x.productId === l.productId
                          ? { ...x, quantity: Math.max(1, Number(e.target.value) || 1) }
                          : x,
                      ),
                    )
                  }
                />
              </div>
            ))}
            {!lines.length && (
              <p className="text-sm text-[#6B7280]">Add products from the left panel.</p>
            )}
          </div>

          <label className="block text-xs font-medium text-[#6B7280]">Transport Cost</label>
          <Input
            type="number"
            value={transportCost}
            onChange={(e) => setTransportCost(Number(e.target.value) || 0)}
          />

          <label className="block text-xs font-medium text-[#6B7280]">Paid Amount</label>
          <Input
            type="number"
            value={paidAmount}
            onChange={(e) => setPaidAmount(Number(e.target.value) || 0)}
          />

          <label className="block text-xs font-medium text-[#6B7280]">Payment Account</label>
          <select
            className="w-full rounded-xl border px-3 py-2 text-sm"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            {db.financialAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({formatBDT(a.balance)})
              </option>
            ))}
          </select>

          <div className="rounded-xl bg-[#F8F6F2] p-3 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatBDT(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total</span>
              <span className="font-semibold">{formatBDT(total)}</span>
            </div>
            <div className="flex justify-between text-[#6B7280]">
              <span>Due — Current Balance</span>
              <span>{formatBDT(Math.max(0, total - paidAmount))}</span>
            </div>
          </div>

          <Button className="w-full rounded-full" disabled={saving || !lines.length} onClick={save}>
            {saving ? 'Saving…' : 'Save Purchase'}
          </Button>
        </div>
      </div>
    </ModuleShell>
  )
}
