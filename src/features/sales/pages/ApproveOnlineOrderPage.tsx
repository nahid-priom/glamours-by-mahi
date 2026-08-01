import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Minus, Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/features/auth/auth-session'
import { listPosCatalogue } from '@/features/pos/repositories/pos.repository'
import { formatBDT } from '@/lib/format'
import { getSale, type SaleDetail } from '../repositories/sales.repository'
import { approveOnlineOrder } from '../repositories/online-orders.repository'

type SaleDetailView = SaleDetail & {
  order_source?: string | null
  channel?: string | null
  fulfilment_status?: string | null
}

type AddLine = {
  variantId: string
  label: string
  sku: string
  unitPrice: number
  qty: number
  stock: number
}

export function ApproveOnlineOrderPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const qc = useQueryClient()
  const { profile } = useAuth()
  const branchId = profile?.default_branch_id ?? ''

  const [search, setSearch] = useState('')
  const [addLines, setAddLines] = useState<AddLine[]>([])
  const [increases, setIncreases] = useState<Record<string, number>>({})
  const [shipping, setShipping] = useState<number | null>(null)
  const [discount, setDiscount] = useState<number | null>(null)

  const { data: sale, isLoading, error } = useQuery({
    queryKey: ['sale', id],
    queryFn: () => getSale(id!),
    enabled: Boolean(id),
  })

  const { data: catalogue } = useQuery({
    queryKey: ['approve-catalogue', branchId || sale?.branch_id],
    queryFn: () => listPosCatalogue({ branchId: branchId || sale!.branch_id, pageSize: 80 }),
    enabled: Boolean(branchId || sale?.branch_id),
    staleTime: 60_000,
  })

  const existingItems = useMemo(
    () => (sale?.sale_items ?? []).filter((i) => !i.deleted_at),
    [sale?.sale_items],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const items = catalogue?.items ?? []
    if (!q) return items.slice(0, 30)
    return items
      .filter(
        (v) =>
          v.productName.toLowerCase().includes(q) ||
          v.sku.toLowerCase().includes(q) ||
          v.variantLabel.toLowerCase().includes(q),
      )
      .slice(0, 30)
  }, [catalogue?.items, search])

  const addSubtotal = addLines.reduce((s, l) => s + l.qty * l.unitPrice, 0)
  const increaseSubtotal = existingItems.reduce((s, item) => {
    const addQty = increases[item.id] ?? 0
    return s + addQty * Number(item.unit_price)
  }, 0)
  const previewTotal =
    Number(sale?.subtotal ?? 0) +
    addSubtotal +
    increaseSubtotal -
    (discount ?? Number(sale?.discount ?? 0)) +
    (shipping ?? Number(sale?.shipping ?? 0))

  const approveMut = useMutation({
    mutationFn: () => {
      if (!id) throw new Error('Missing sale id')
      const add_items = addLines.map((l) => ({
        variant_id: l.variantId,
        qty: l.qty,
        unit_price: l.unitPrice,
      }))
      const increase_items = Object.entries(increases)
        .filter(([, qty]) => qty > 0)
        .map(([sale_item_id, add_qty]) => ({ sale_item_id, add_qty }))
      return approveOnlineOrder({
        sale_id: id,
        add_items: add_items.length ? add_items : undefined,
        increase_items: increase_items.length ? increase_items : undefined,
        shipping: shipping ?? undefined,
        discount: discount ?? undefined,
      })
    },
    onSuccess: async () => {
      toast('Order approved — commission will split by who generated each item')
      await qc.invalidateQueries({ queryKey: ['online-orders'] })
      await qc.invalidateQueries({ queryKey: ['sale', id] })
      navigate('/sales/online-orders')
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  if (isLoading) {
    return <div className="p-6 text-sm text-[#6B7280]">Loading order…</div>
  }
  if (error || !sale) {
    return (
      <div className="space-y-3 p-6">
        <p className="text-sm text-destructive">{(error as Error)?.message ?? 'Order not found'}</p>
        <Button asChild variant="outline">
          <Link to="/sales/online-orders">Back</Link>
        </Button>
      </div>
    )
  }

  if (sale.fulfilment_status !== 'pending_approval' || sale.status !== 'draft') {
    return (
      <div className="mx-auto max-w-xl space-y-3 p-6">
        <h1 className="text-xl font-bold">Cannot approve</h1>
        <p className="text-sm text-[#6B7280]">
          This order is already {sale.fulfilment_status ?? sale.status}.
        </p>
        <Button asChild>
          <Link to={`/sales/${sale.id}`}>View sale</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 pb-28 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
            Review & Approve · {(sale as SaleDetailView).order_source ?? sale.channel}
          </p>
          <h1 className="text-xl font-bold">{sale.invoice_no}</h1>
          <p className="text-sm text-[#6B7280]">
            {sale.customers?.name ?? 'Customer'} · {sale.customers?.phone}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/sales/online-orders">Cancel</Link>
        </Button>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-[#78350F]">
        Moderator-এর original items-এর commission Moderator পাবেন। আপনি যে নতুন item বা qty increase
        করবেন, সেই অংশের commission আপনার (Tele Sales) হবে।
      </div>

      <section className="rounded-2xl border bg-white">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Original items (Moderator / Creator)</h2>
        </div>
        <ul className="divide-y">
          {existingItems.map((item) => {
            const label =
              item.product_variants?.products?.name ??
              item.product_variants?.name ??
              item.product_variants?.sku ??
              'Item'
            const addQty = increases[item.id] ?? 0
            return (
              <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{label}</p>
                  <p className="text-xs text-[#6B7280]">
                    Qty {item.qty} · {formatBDT(Number(item.line_total))} · Generator kept
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#6B7280]">+ Increase</span>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-9 w-9"
                    onClick={() =>
                      setIncreases((prev) => ({
                        ...prev,
                        [item.id]: Math.max((prev[item.id] ?? 0) - 1, 0),
                      }))
                    }
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center text-sm font-semibold">{addQty}</span>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-9 w-9"
                    onClick={() =>
                      setIncreases((prev) => ({
                        ...prev,
                        [item.id]: (prev[item.id] ?? 0) + 1,
                      }))
                    }
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="space-y-3 rounded-2xl border bg-white p-4">
        <h2 className="text-sm font-semibold">Add new items (your commission)</h2>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
          <Input
            className="pl-9"
            placeholder="Search product…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="grid max-h-48 gap-1 overflow-y-auto sm:grid-cols-2">
          {filtered.map((v) => (
            <button
              key={v.variantId}
              type="button"
              className="rounded-xl border px-3 py-2 text-left text-sm hover:bg-[#F9FAFB]"
              onClick={() => {
                setAddLines((prev) => {
                  const existing = prev.find((l) => l.variantId === v.variantId)
                  if (existing) {
                    return prev.map((l) =>
                      l.variantId === v.variantId ? { ...l, qty: l.qty + 1 } : l,
                    )
                  }
                  return [
                    ...prev,
                    {
                      variantId: v.variantId,
                      label: `${v.productName} ${v.variantLabel}`.trim(),
                      sku: v.sku,
                      unitPrice: Number(v.unitPrice),
                      qty: 1,
                      stock: Number(v.availableStock ?? 0),
                    },
                  ]
                })
              }}
            >
              <span className="font-medium">{v.productName}</span>
              <span className="mt-0.5 block text-xs text-[#6B7280]">
                {v.sku} · {formatBDT(Number(v.unitPrice))}
              </span>
            </button>
          ))}
        </div>

        {addLines.length > 0 ? (
          <ul className="divide-y rounded-xl border">
            {addLines.map((l) => (
              <li key={l.variantId} className="flex items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{l.label}</p>
                  <p className="text-xs text-[#6B7280]">{formatBDT(l.unitPrice * l.qty)}</p>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  onClick={() =>
                    setAddLines((prev) =>
                      prev
                        .map((x) =>
                          x.variantId === l.variantId ? { ...x, qty: x.qty - 1 } : x,
                        )
                        .filter((x) => x.qty > 0),
                    )
                  }
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span className="w-6 text-center text-sm">{l.qty}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  onClick={() =>
                    setAddLines((prev) =>
                      prev.map((x) =>
                        x.variantId === l.variantId ? { ...x, qty: x.qty + 1 } : x,
                      ),
                    )
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() =>
                    setAddLines((prev) => prev.filter((x) => x.variantId !== l.variantId))
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Shipping</Label>
          <Input
            type="number"
            min={0}
            value={shipping ?? Number(sale.shipping ?? 0)}
            onChange={(e) => setShipping(Number(e.target.value) || 0)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Discount</Label>
          <Input
            type="number"
            min={0}
            value={discount ?? Number(sale.discount ?? 0)}
            onChange={(e) => setDiscount(Number(e.target.value) || 0)}
          />
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 p-3 backdrop-blur md:static md:rounded-2xl md:border md:bg-white md:p-4">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-[#6B7280]">Preview total after approval</p>
            <p className="text-lg font-bold">{formatBDT(previewTotal)}</p>
          </div>
          <Button
            size="lg"
            disabled={approveMut.isPending}
            onClick={() => approveMut.mutate()}
          >
            {approveMut.isPending ? 'Approving…' : 'Approve order'}
          </Button>
        </div>
      </div>
    </div>
  )
}
