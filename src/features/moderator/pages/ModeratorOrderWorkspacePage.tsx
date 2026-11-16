import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Minus, Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/features/auth/auth-session'
import { CustomerRecentOrders } from '@/features/customers/components/CustomerRecentOrders'
import { CustomerSummaryCard } from '@/features/customers/components/CustomerSummaryCard'
import { getPosCustomerSummary } from '@/features/customer-rating'
import { PosCustomerSelect } from '@/features/pos/components/PosCustomerSelect'
import { listPosCatalogue } from '@/features/pos/repositories/pos.repository'
import type { PosVariant } from '@/features/pos/types'
import { formatBDT } from '@/lib/format'
import { createStaffOnlineOrder } from '../repositories/moderator.repository'
import { toastRpcError } from '@/lib/errors/rpc-error'

type CartLine = {
  variantId: string
  label: string
  sku: string
  unitPrice: number
  qty: number
  stock: number
  imageUrl: string | null
}

export function ModeratorOrderWorkspacePage() {
  const { profile, can } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const branchId = profile?.default_branch_id ?? ''
  const [search, setSearch] = useState('')
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [customerLabel, setCustomerLabel] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [district, setDistrict] = useState('')
  const [notes, setNotes] = useState('')
  const [shipping, setShipping] = useState(0)
  const [discount, setDiscount] = useState(0)
  const [lines, setLines] = useState<CartLine[]>([])

  const { data: catalogue, isLoading } = useQuery({
    queryKey: ['moderator-catalogue', branchId],
    queryFn: () => listPosCatalogue({ branchId, pageSize: 80 }),
    enabled: Boolean(branchId),
    staleTime: 60_000,
  })

  const { data: customerSummary } = useQuery({
    queryKey: ['pos-customer-summary', profile?.organization_id, customerId],
    queryFn: () => getPosCustomerSummary(customerId!),
    enabled: Boolean(customerId) && Boolean(profile?.organization_id),
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!customerSummary) return
    setCustomerName(customerSummary.name || '')
    setPhone(customerSummary.phone || '')
    if (customerSummary.address) setAddress(customerSummary.address)
    if (customerSummary.district) setDistrict(customerSummary.district)
  }, [customerSummary])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const items = catalogue?.items ?? []
    if (!q) return items.slice(0, 40)
    return items
      .filter(
        (v) =>
          v.productName.toLowerCase().includes(q) ||
          v.sku.toLowerCase().includes(q) ||
          v.variantLabel.toLowerCase().includes(q) ||
          (v.barcode ?? '').toLowerCase().includes(q),
      )
      .slice(0, 40)
  }, [catalogue?.items, search])

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0)
  const grandTotal = Math.max(0, subtotal - discount + shipping)

  function addVariant(v: PosVariant) {
    const label = `${v.productName}${v.variantLabel ? ` · ${v.variantLabel}` : ''}`
    const existing = lines.find((l) => l.variantId === v.variantId)
    if (existing) {
      if (existing.qty + 1 > v.availableStock) {
        toast('Not enough stock', 'error')
        return
      }
      const nextQty = existing.qty + 1
      setLines((prev) =>
        prev.map((l) => (l.variantId === v.variantId ? { ...l, qty: nextQty } : l)),
      )
      toast(`${label} · qty ${nextQty}`)
      return
    }
    if (v.availableStock < 1) {
      toast('Out of stock', 'error')
      return
    }
    setLines((prev) => [
      ...prev,
      {
        variantId: v.variantId,
        label,
        sku: v.sku,
        unitPrice: v.unitPrice,
        qty: 1,
        stock: v.availableStock,
        imageUrl: v.thumbnailUrl ?? null,
      },
    ])
    toast(`${label} · qty 1`)
  }

  const submit = useMutation({
    mutationFn: async () => {
      if (!branchId) throw new Error('No branch selected')
      if (lines.length === 0) throw new Error('Add at least one product')
      const name = customerName.trim() || customerLabel?.split('·')[0]?.trim() || ''
      const mobile = phone.trim()
      if (!name || !mobile) throw new Error('Customer name and mobile are required')
      return createStaffOnlineOrder({
        client_txn_key: `mod-${crypto.randomUUID()}`,
        branch_id: branchId,
        order_source: 'moderator',
        customer_id: customerId,
        customer_name: name,
        phone: mobile,
        address: address.trim() || null,
        district: district.trim() || null,
        notes: notes.trim() || null,
        shipping,
        discount,
        items: lines.map((l) => ({
          variant_id: l.variantId,
          qty: l.qty,
          unit_price: l.unitPrice,
        })),
      })
    },
    onSuccess: (res) => {
      toast(`Order ${res.invoice_no} created`, 'success')
      navigate('/moderator')
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 pb-28 md:p-6 lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)] lg:pb-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-[#111827]">Moderator order</h1>
            <p className="text-sm text-[#6B7280]">Create an online order for approval — not a POS sale</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/moderator">Dashboard</Link>
          </Button>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
          <Input
            className="pl-9"
            placeholder="Search by name, SKU, or variant…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-36 animate-pulse rounded-xl bg-[#F3F4F6]" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {filtered.map((v) => (
              <button
                key={v.variantId}
                type="button"
                onClick={() => addVariant(v)}
                className="rounded-xl border border-border bg-white p-2 text-left hover:border-[#E11D48]/40"
              >
                <div className="aspect-square overflow-hidden rounded-lg bg-[#F3F4F6]">
                  {v.thumbnailUrl ? (
                    <img src={v.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <p className="mt-1.5 line-clamp-2 text-xs font-medium text-[#111827]">
                  {v.productName}
                  {v.variantLabel ? ` · ${v.variantLabel}` : ''}
                </p>
                <p className="text-[11px] text-[#6B7280]">{v.sku}</p>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="font-semibold">{formatBDT(v.unitPrice)}</span>
                  <span className={v.availableStock > 0 ? 'text-emerald-700' : 'text-[#E11D48]'}>
                    Stock {v.availableStock}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
        <div className="rounded-xl border border-border bg-white p-3 space-y-3">
          <p className="text-sm font-semibold">Customer</p>
          {can('customers.read') ? (
            <PosCustomerSelect
              value={customerId}
              onChange={(id, label) => {
                setCustomerId(id)
                setCustomerLabel(label)
                if (!id) {
                  setCustomerName('')
                  setPhone('')
                  setAddress('')
                  setDistrict('')
                  return
                }
                if (label) {
                  const [n, p] = label.split('·').map((s) => s.trim())
                  if (n) setCustomerName(n)
                  if (p) setPhone(p)
                }
              }}
              organizationId={profile?.organization_id ?? ''}
              branchId={branchId}
              createdBy={profile?.id ?? null}
              canCreate={can('customers.manage')}
              showSummary={false}
            />
          ) : null}
          {customerId ? (
            <>
              <CustomerSummaryCard
                customerId={customerId}
                compact
                onClear={() => {
                  setCustomerId(null)
                  setCustomerLabel(null)
                  setCustomerName('')
                  setPhone('')
                  setAddress('')
                  setDistrict('')
                }}
              />
              <CustomerRecentOrders customerId={customerId} />
            </>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label>Name</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </div>
            <div>
              <Label>Mobile</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Delivery address</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div>
              <Label>District</Label>
              <Input value={district} onChange={(e) => setDistrict(e.target.value)} />
            </div>
            <div>
              <Label>Delivery charge</Label>
              <Input
                type="number"
                min={0}
                value={shipping || ''}
                onChange={(e) => setShipping(Number(e.target.value) || 0)}
              />
            </div>
            {can('pos.discount') ? (
              <div>
                <Label>Discount</Label>
                <Input
                  type="number"
                  min={0}
                  value={discount || ''}
                  onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                />
              </div>
            ) : null}
            <div className="sm:col-span-2">
              <Label>Order notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-white p-3">
          <p className="mb-2 text-sm font-semibold">Order summary</p>
          {lines.length === 0 ? (
            <p className="text-sm text-[#6B7280]">No items yet</p>
          ) : (
            <ul className="space-y-2">
              {lines.map((l) => (
                <li key={l.variantId} className="flex items-start gap-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 font-medium">{l.label}</p>
                    <p className="text-xs text-[#6B7280]">
                      {l.sku} · {formatBDT(l.unitPrice)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={() =>
                        setLines((prev) =>
                          prev
                            .map((x) =>
                              x.variantId === l.variantId
                                ? { ...x, qty: Math.max(0, x.qty - 1) }
                                : x,
                            )
                            .filter((x) => x.qty > 0),
                        )
                      }
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-xs">{l.qty}</span>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={() => {
                        if (l.qty + 1 > l.stock) {
                          toast('Not enough stock', 'error')
                          return
                        }
                        const nextQty = l.qty + 1
                        setLines((prev) =>
                          prev.map((x) =>
                            x.variantId === l.variantId ? { ...x, qty: nextQty } : x,
                          ),
                        )
                        toast(`${l.label} · qty ${nextQty}`)
                      }}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() =>
                        setLines((prev) => prev.filter((x) => x.variantId !== l.variantId))
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5 text-[#E11D48]" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between">
              <span className="text-[#6B7280]">Subtotal</span>
              <span>{formatBDT(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6B7280]">Discount</span>
              <span>-{formatBDT(discount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6B7280]">Delivery</span>
              <span>{formatBDT(shipping)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>{formatBDT(grandTotal)}</span>
            </div>
          </div>
          <Button
            className="mt-3 w-full"
            disabled={submit.isPending || lines.length === 0}
            onClick={() => submit.mutate()}
          >
            {submit.isPending ? 'Submitting…' : 'Submit for approval'}
          </Button>
        </div>
      </aside>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-white p-3 lg:hidden">
        <Button
          className="w-full"
          disabled={submit.isPending || lines.length === 0}
          onClick={() => submit.mutate()}
        >
          Submit · {formatBDT(grandTotal)}
        </Button>
      </div>
    </div>
  )
}
