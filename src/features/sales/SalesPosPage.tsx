import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react'
import { peekDatabase } from '@/database/transaction'
import { salesService } from '@/services/sales.service'
import { formatBDT } from '@/lib/format'
import { getProductCoverImage } from '@/lib/images/product-image-utils'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/features/auth/auth.context'
import { AppImage } from '@/components/common/AppImage'
import { CustomerSearchSelect } from '@/features/customers/components/CustomerSearchSelect'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { PaymentMethod, SalesChannel } from '@/database/schema'
import { toastRpcError } from '@/lib/errors/rpc-error'

interface CartLine {
  productId: string
  name: string
  image: string
  unitPrice: number
  quantity: number
  discount: number
}

const CHANNELS: SalesChannel[] = [
  'Physical Shop',
  'Website',
  'Facebook',
  'WhatsApp',
  'Phone Order',
  'Marketplace',
]

const PAYMENTS: PaymentMethod[] = [
  'Cash',
  'Card',
  'bKash',
  'Nagad',
  'Bank Transfer',
  'COD',
  'Mixed',
]

export function SalesPosPage() {
  const db = peekDatabase()
  const { session } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [inStockOnly, setInStockOnly] = useState(false)
  const [customerId, setCustomerId] = useState<string | null>(db.customers[0]?.id ?? null)
  const [branchId, setBranchId] = useState(session.branchId ?? db.branches[0]?.id ?? '')
  const [salespersonId, setSalespersonId] = useState(db.employees[0]?.id ?? '')
  const [channel, setChannel] = useState<SalesChannel>('Physical Shop')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash')
  const [accountId, setAccountId] = useState(
    db.financialAccounts.find((a) => a.type === 'Cash')?.id ?? '',
  )
  const [deliveryMethod, setDeliveryMethod] = useState<'Pickup' | 'Home Delivery' | 'Courier'>(
    'Pickup',
  )
  const [courierId, setCourierId] = useState('')
  const courierOptions = useMemo(() => {
    const names = [...new Set(db.courierBookings.map((b) => b.courierName).filter(Boolean))]
    return names.length > 0 ? names : ['Steadfast', 'Pathao Courier', 'RedX', 'Paperfly', 'Sundarban Courier']
  }, [db.courierBookings])
  const [paidAmount, setPaidAmount] = useState(0)
  const [note, setNote] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [saving, setSaving] = useState(false)
  const [mobileStep, setMobileStep] = useState(1)
  const [mobileCartOpen, setMobileCartOpen] = useState(false)

  const products = useMemo(() => {
    const q = search.trim().toLowerCase()
    return db.products
      .filter((p) => p.status === 'active' && !p.deleted_at)
      .filter((p) => !categoryId || p.categoryId === categoryId)
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q),
      )
      .filter((p) => {
        if (!inStockOnly) return true
        const bal = db.stockBalances.find(
          (b) => b.productId === p.id && b.branchId === branchId,
        )
        return (bal?.quantity ?? 0) - (bal?.reserved ?? 0) > 0
      })
      .slice(0, 60)
  }, [db.products, db.stockBalances, search, inStockOnly, branchId, categoryId])

  const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0)
  const discount = cart.reduce((s, l) => s + l.discount, 0)
  const total = Math.max(0, subtotal - discount)
  const due = Math.max(0, total - paidAmount)

  const stockFor = (productId: string) => {
    const bal = db.stockBalances.find((b) => b.productId === productId && b.branchId === branchId)
    return (bal?.quantity ?? 0) - (bal?.reserved ?? 0)
  }

  const addProduct = (productId: string) => {
    const product = db.products.find((p) => p.id === productId)
    if (!product) return
    const available = stockFor(productId)
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === productId)
      if (existing) {
        if (available > 0 && existing.quantity >= available) {
          toast('Stock limit reached for this product', 'error')
          return prev
        }
        return prev.map((l) =>
          l.productId === productId ? { ...l, quantity: l.quantity + 1 } : l,
        )
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          image: getProductCoverImage(product),
          unitPrice: product.salePrice ?? product.price,
          quantity: 1,
          discount: 0,
        },
      ]
    })
    setPaidAmount((prev) => {
      if (prev > 0) return prev
      return product.salePrice ?? product.price
    })
  }

  const clearSale = () => {
    if (cart.length > 0 && !window.confirm('Clear the current sale? Cart items will be removed.')) {
      return
    }
    setCart([])
    setPaidAmount(0)
    setNote('')
    setSearch('')
    setCategoryId('')
  }

  const saveSale = async () => {
    if (saving || cart.length === 0) return
    if (!customerId || !branchId || !salespersonId || !accountId) {
      toast('Customer, branch, salesperson and account are required', 'error')
      return
    }
    setSaving(true)
    try {
      const sale = salesService.create({
        customerId,
        branchId,
        salespersonId,
        channel,
        items: cart.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discount: l.discount,
        })),
        paymentMethod,
        paidAmount: Math.min(Math.max(0, paidAmount), total),
        accountId,
        deliveryMethod,
        courierId: deliveryMethod === 'Courier' ? courierId : undefined,
        note: note || undefined,
        idempotencyKey: `pos-${Date.now()}`,
        userName: session.name,
      })
      toast('Sale completed successfully')
      navigate(`/sales/${sale.id}`)
    } catch (e) {
      toastRpcError(toast, e, 'Could not save sale')
    } finally {
      setSaving(false)
    }
  }

  const SetupFields = (
    <div className="space-y-3">
      <CustomerSearchSelect
        value={customerId}
        onChange={setCustomerId}
        preferredBranchId={branchId}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-[#6B7280]">
          Branch
          <select
            className="mt-1 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          >
            {db.branches
              .filter((b) => b.isActive)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-[#6B7280]">
          Salesperson
          <select
            className="mt-1 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm"
            value={salespersonId}
            onChange={(e) => setSalespersonId(e.target.value)}
          >
            {db.employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-[#6B7280] sm:col-span-2">
          Sales Channel
          <select
            className="mt-1 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm"
            value={channel}
            onChange={(e) => setChannel(e.target.value as SalesChannel)}
          >
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )

  const ProductBrowser = (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, SKU or barcode…"
            className="pl-9"
          />
        </div>
        <select
          className="h-10 rounded-xl border border-[#E5E7EB] bg-white px-3 text-xs"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">All categories</option>
          {db.categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 rounded-full border border-[#E5E7EB] px-3 py-2 text-xs font-medium">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => setInStockOnly(e.target.checked)}
            className="rounded"
          />
          In stock
        </label>
        {(search || categoryId || inStockOnly) && (
          <button
            type="button"
            className="inline-flex h-10 items-center gap-1 rounded-full border border-[#E5E7EB] px-3 text-xs font-medium"
            onClick={() => {
              setSearch('')
              setCategoryId('')
              setInStockOnly(false)
            }}
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>
      <p className="mt-2 text-[11px] text-[#6B7280]">{products.length} products</p>
      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
        {products.map((p) => {
          const qty = stockFor(p.id)
          const out = qty <= 0
          const low = qty > 0 && qty <= 5
          const inCart = cart.some((l) => l.productId === p.id)
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => addProduct(p.id)}
              className={cn(
                'group rounded-2xl border bg-white p-2 text-left transition hover:border-[#E11D48]/35 hover:shadow-sm',
                inCart ? 'border-[#E11D48]/50 ring-1 ring-[#E11D48]/20' : 'border-[#E5E7EB]',
              )}
            >
              <div className="relative overflow-hidden rounded-xl">
                <AppImage
                  src={getProductCoverImage(p)}
                  alt={p.name}
                  aspectRatio="portrait"
                  className="w-full"
                  objectFit="cover"
                />
                {out && (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-[#111111]/85 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                    Out of stock
                  </span>
                )}
                {low && !out && (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-bold uppercase text-white">
                    Low
                  </span>
                )}
              </div>
              <p className="mt-2 line-clamp-2 text-[11px] font-semibold leading-4 text-[#111111]">
                {p.name}
              </p>
              <p className="mt-0.5 truncate text-[10px] text-[#6B7280]">{p.sku}</p>
              <div className="mt-1 flex items-center justify-between gap-1">
                <p className="text-sm font-bold text-[#E11D48]">
                  {formatBDT(p.salePrice ?? p.price)}
                </p>
                <p className="text-[10px] text-[#6B7280]">{qty} left</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )

  const CartPanel = (
    <div className="flex h-full flex-col">
      <div className="border-b border-[#E5E7EB] px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#111111]">Cart ({cart.length})</h2>
          {cart.length > 0 && (
            <button type="button" onClick={clearSale} className="text-[11px] font-semibold text-[#E11D48]">
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {cart.length === 0 && (
          <p className="px-1 py-8 text-center text-sm text-[#6B7280]">
            Add products to start a sale.
          </p>
        )}
        {cart.map((line) => (
          <div key={line.productId} className="flex gap-2.5 rounded-xl border border-[#E5E7EB] p-2.5">
            <AppImage
              src={getProductCoverImage({ id: line.productId, name: line.name, image: line.image })}
              alt={line.name}
              className="h-14 w-12 shrink-0 rounded-lg"
              aspectRatio="auto"
              objectFit="cover"
            />
            <div className="min-w-0 flex-1">
              <div className="flex justify-between gap-2">
                <p className="line-clamp-2 text-xs font-semibold text-[#111111]">{line.name}</p>
                <button
                  type="button"
                  onClick={() => setCart((c) => c.filter((x) => x.productId !== line.productId))}
                  aria-label="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5 text-[#E11D48]" />
                </button>
              </div>
              <p className="mt-0.5 text-[11px] text-[#6B7280]">{formatBDT(line.unitPrice)} each</p>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center rounded-full border border-[#E5E7EB]">
                  <button
                    type="button"
                    className="px-2 py-1"
                    onClick={() =>
                      setCart((c) =>
                        c.map((x) =>
                          x.productId === line.productId
                            ? { ...x, quantity: Math.max(1, x.quantity - 1) }
                            : x,
                        ),
                      )
                    }
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-7 text-center text-xs font-semibold">{line.quantity}</span>
                  <button
                    type="button"
                    className="px-2 py-1"
                    onClick={() => addProduct(line.productId)}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <span className="text-sm font-bold">
                  {formatBDT(line.unitPrice * line.quantity - line.discount)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3 border-t border-[#E5E7EB] p-4">
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-[#6B7280]">Subtotal</span><span>{formatBDT(subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-[#6B7280]">Discount</span><span>{formatBDT(discount)}</span></div>
          <div className="flex justify-between text-base font-bold"><span>Grand Total</span><span>{formatBDT(total)}</span></div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <select
            className="rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
          >
            {PAYMENTS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select
            className="rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            {db.financialAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        <Input
          type="number"
          min={0}
          max={total}
          value={paidAmount}
          onChange={(e) => setPaidAmount(Math.min(total, Math.max(0, Number(e.target.value) || 0)))}
          placeholder="Paid amount"
        />
        <p className="text-xs text-[#6B7280]">Due: <span className="font-semibold text-[#111111]">{formatBDT(due)}</span></p>

        <select
          className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm"
          value={deliveryMethod}
          onChange={(e) => setDeliveryMethod(e.target.value as typeof deliveryMethod)}
        >
          <option value="Pickup">Store Pickup</option>
          <option value="Home Delivery">Home Delivery</option>
          <option value="Courier">Courier</option>
        </select>

        {deliveryMethod === 'Courier' && (
          <select
            className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm"
            value={courierId}
            onChange={(e) => setCourierId(e.target.value)}
          >
            <option value="">Select courier</option>
            {courierOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        )}

        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Payment / sale note" />

        <Button
          className="h-12 w-full rounded-full bg-[#111111] text-sm font-semibold hover:bg-[#E11D48]"
          disabled={saving || cart.length === 0}
          onClick={saveSale}
        >
          {saving ? 'Saving…' : `Save Sale · ${formatBDT(total)}`}
        </Button>
      </div>
    </div>
  )

  return (
    <div className="mx-auto max-w-[1366px] space-y-4 pb-24 lg:pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/sales"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E7EB] bg-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-[#111111] sm:text-2xl">New Sale</h1>
            <p className="text-xs text-[#6B7280]">
              {session.name} · {db.branches.find((b) => b.id === branchId)?.name ?? 'Branch'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-full" onClick={clearSale}>
            Clear Sale
          </Button>
        </div>
      </div>

      {/* Mobile stepper */}
      <div className="flex gap-1 lg:hidden">
        {['Setup', 'Products', 'Cart', 'Pay'].map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setMobileStep(i + 1)}
            className={cn(
              'flex-1 rounded-full py-2 text-[10px] font-bold uppercase tracking-wide',
              mobileStep === i + 1 ? 'bg-[#111111] text-white' : 'bg-[#F1F5F9] text-[#6B7280]',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[65%_35%]">
        <div className="min-w-0 space-y-4">
          <div className={cn('rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm', mobileStep !== 1 && 'hidden lg:block')}>
            <h2 className="mb-3 text-sm font-semibold">Customer & Order Setup</h2>
            {SetupFields}
          </div>
          <div className={cn('rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm', mobileStep !== 2 && 'hidden lg:block')}>
            <h2 className="mb-3 text-sm font-semibold">Products</h2>
            {ProductBrowser}
          </div>
          <div className={cn('rounded-2xl border border-[#E5E7EB] bg-white shadow-sm lg:hidden', mobileStep < 3 && 'hidden')}>
            {CartPanel}
          </div>
        </div>

        <div className="sticky top-24 hidden max-h-[calc(100vh-140px)] overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm lg:block">
          {CartPanel}
        </div>
      </div>

      {/* Mobile sticky cart opener */}
      <div className="fixed bottom-20 left-4 right-4 z-40 lg:hidden">
        <Button
          className="h-12 w-full rounded-full bg-[#111111] shadow-lg hover:bg-[#E11D48]"
          onClick={() => {
            setMobileStep(3)
            setMobileCartOpen(true)
          }}
        >
          <ShoppingBag className="h-4 w-4" />
          Cart ({cart.length}) · {formatBDT(total)}
        </Button>
      </div>

      {mobileCartOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-black/40" onClick={() => setMobileCartOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[90vh] overflow-hidden rounded-t-3xl bg-white">
            {CartPanel}
          </div>
        </div>
      )}
    </div>
  )
}
