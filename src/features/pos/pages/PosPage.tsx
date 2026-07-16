import { useCallback, useEffect, useRef, useState } from 'react'
import { Pause, Plus, ShoppingCart } from 'lucide-react'
import { EntityCombobox } from '@/components/entity-combobox'
import { AppImage } from '@/components/common/AppImage'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/features/auth/auth-session'
import { formatBDT } from '@/lib/format'
import { cn } from '@/lib/utils'
import { assertSaleReady, canAddQty } from '../cart-utils'
import { PosBarcodeInput } from '../components/PosBarcodeInput'
import { PosCartPanel } from '../components/PosCartPanel'
import { PosProductCard } from '../components/PosProductCard'
import {
  completeSale,
  findVariantByBarcodeExact,
  listFinancialAccounts,
  listPaymentMethods,
  saveHeldSale,
  searchCustomers,
  searchPosVariants,
} from '../repositories/pos.repository'
import type { PosVariant } from '../types'
import { usePosCart } from '../use-pos-cart'
import { QuickAddProductDialog } from '@/features/products/components/QuickAddProductDialog'

export function PosPage() {
  const { activeBranchId, profile, can } = useAuth()
  const { toast } = useToast()
  const cart = usePosCart()
  const barcodeRef = useRef<HTMLInputElement>(null)

  const branchId = activeBranchId
  const canDiscount = can('pos.discount')

  const [search, setSearch] = useState('')
  const [variants, setVariants] = useState<PosVariant[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [methods, setMethods] = useState<Array<{ code: string; name: string }>>([])
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([])
  const [payMethod, setPayMethod] = useState('cash')
  const [payAmount, setPayAmount] = useState('')
  const [payAccountId, setPayAccountId] = useState('')
  const [quickAddOpen, setQuickAddOpen] = useState(false)

  const loadPage = useCallback(
    async (q: string, reset: boolean) => {
      if (!branchId) return
      if (reset) setLoading(true)
      else setLoadingMore(true)
      try {
        const res = await searchPosVariants({
          query: q,
          branchId,
          cursor: reset ? null : cursor,
          pageSize: 24,
        })
        setVariants((prev) => (reset ? res.items : [...prev, ...res.items]))
        setCursor(res.nextCursor)
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Failed to load products', 'error')
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [branchId, cursor, toast],
  )

  useEffect(() => {
    if (!branchId) return
    const t = setTimeout(() => {
      setCursor(null)
      void loadPage(search, true)
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional debounce on search/branch only
  }, [search, branchId])

  useEffect(() => {
    void listPaymentMethods()
      .then((rows) => {
        setMethods(rows.map((r) => ({ code: r.code, name: r.name })))
        if (rows[0]) setPayMethod(rows[0].code)
      })
      .catch(() => setMethods([{ code: 'cash', name: 'Cash' }]))
    if (branchId) {
      void listFinancialAccounts(branchId)
        .then((rows) => {
          setAccounts(rows.map((r) => ({ id: r.id, name: r.name })))
          if (rows[0]) setPayAccountId(rows[0].id)
        })
        .catch(() => setAccounts([]))
    }
  }, [branchId])

  const handleAdd = (variant: PosVariant) => {
    const existing = cart.state.lines.find((l) => l.variantId === variant.variantId)
    if (existing ? !canAddQty(existing, 1) : variant.availableStock <= 0) {
      toast('Stock limit reached', 'error')
      return
    }
    cart.addVariant(variant, 1)
  }

  const handleScan = async (code: string) => {
    if (!branchId) return
    try {
      const variant = await findVariantByBarcodeExact(code, branchId)
      if (!variant) {
        toast('Barcode not found', 'error')
        return
      }
      handleAdd(variant)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Scan failed', 'error')
    }
  }

  const addPayment = () => {
    const amount = Number(payAmount)
    if (!payMethod || !(amount > 0)) {
      toast('Enter a valid payment amount', 'error')
      return
    }
    if (cart.state.payments.some((p) => p.method.toLowerCase() === payMethod.toLowerCase())) {
      toast('Duplicate payment methods are not allowed', 'error')
      return
    }
    cart.setPayments([
      ...cart.state.payments,
      {
        method: payMethod,
        amount,
        financialAccountId: payAccountId || undefined,
      },
    ])
    setPayAmount('')
  }

  const handleHold = async () => {
    if (!branchId || !profile) return
    setBusy(true)
    try {
      const payload = cart.serializeHold(branchId)
      await saveHeldSale(payload, profile.organization_id, profile.id)
      toast('Sale held')
      cart.reset()
      barcodeRef.current?.focus()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not hold sale', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleComplete = async () => {
    if (!branchId) return
    setBusy(true)
    try {
      cart.assertReady()
      const { state, totals } = cart
      let payments = state.payments
      if (payments.length === 0 && totals.grandTotal > 0) {
        payments = [{ method: payMethod || 'cash', amount: totals.grandTotal, financialAccountId: payAccountId || undefined }]
      }
      assertSaleReady({ ...state, payments })

      await completeSale({
        branch_id: branchId,
        customer_id: state.customerId,
        client_txn_key: crypto.randomUUID(),
        note: state.note || null,
        discount: state.invoiceDiscount,
        tax: state.tax,
        shipping: state.shipping,
        items: state.lines.map((l) => ({
          variant_id: l.variantId,
          qty: l.qty,
          unit_price: l.unitPrice,
          line_discount: l.lineDiscount,
        })),
        payments: payments.map((p) => ({
          method: p.method,
          amount: p.amount,
          financial_account_id: p.financialAccountId ?? null,
          reference: p.reference ?? null,
        })),
      })
      toast('Sale completed')
      cart.reset()
      barcodeRef.current?.focus()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not complete sale', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!branchId) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-text-muted">
        Select an active branch to use POS.
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-[520px] flex-col gap-3 p-3 lg:flex-row">
      <section className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <PosBarcodeInput ref={barcodeRef} onScan={handleScan} disabled={busy} />
          </div>
          {can('products.create') && profile?.organization_id ? (
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              disabled={busy}
              onClick={() => setQuickAddOpen(true)}
            >
              <Plus className="mr-1 h-4 w-4" />
              Quick add
            </Button>
          ) : null}
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products by name, SKU…"
          aria-label="Product search"
        />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-[3/4] w-full rounded-xl" />
                ))
              : variants.map((v) => (
                  <PosProductCard
                    key={v.variantId}
                    variant={v}
                    onPreviewImage={setPreviewUrl}
                    onAdd={handleAdd}
                  />
                ))}
          </div>
          {!loading && variants.length === 0 ? (
            <p className="py-12 text-center text-sm text-text-muted">No products found</p>
          ) : null}
          {cursor ? (
            <div className="py-3 text-center">
              <Button
                type="button"
                variant="outline"
                disabled={loadingMore}
                onClick={() => void loadPage(search, false)}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      <aside className="flex w-full min-h-0 flex-col rounded-2xl border border-border bg-slate-50/80 p-3 lg:w-[380px]">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <ShoppingCart className="h-4 w-4" />
          Cart
        </div>

        <EntityCombobox
          value={cart.state.customerId}
          onChange={(id, opt) => cart.setCustomer(id, opt?.label ?? null)}
          onSearch={searchCustomers}
          placeholder="Select customer…"
          aria-label="Customer"
          className="mb-3"
        />

        {canDiscount ? (
          <Input
            type="number"
            min={0}
            step="0.01"
            value={cart.state.invoiceDiscount || ''}
            placeholder="Invoice discount"
            aria-label="Invoice discount"
            className="mb-3"
            onChange={(e) => cart.setInvoiceDiscount(Number(e.target.value) || 0)}
          />
        ) : null}

        <PosCartPanel
          className="min-h-0 flex-1"
          lines={cart.state.lines}
          totals={cart.totals}
          showDiscount={canDiscount}
          onAdjustQty={cart.adjustLineQty}
          onSetLineDiscount={cart.setLineDiscount}
          onRemove={cart.removeLine}
        >
          <div className="space-y-2 rounded-xl border border-border bg-white p-2">
            <p className="text-xs font-medium text-text-muted">Payments</p>
            {cart.state.payments.map((p, i) => (
              <div key={`${p.method}-${i}`} className="flex items-center justify-between text-sm">
                <span>
                  {p.method} · {formatBDT(p.amount)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => cart.setPayments(cart.state.payments.filter((_, j) => j !== i))}
                >
                  Remove
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <select
                className="h-9 rounded-xl border border-border bg-white px-2 text-sm"
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                aria-label="Payment method"
              >
                {(methods.length ? methods : [{ code: 'cash', name: 'Cash' }]).map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.name}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="Amount"
                className="w-28"
                aria-label="Payment amount"
              />
              {accounts.length > 0 ? (
                <select
                  className="h-9 min-w-0 flex-1 rounded-xl border border-border bg-white px-2 text-sm"
                  value={payAccountId}
                  onChange={(e) => setPayAccountId(e.target.value)}
                  aria-label="Financial account"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              ) : null}
              <Button type="button" variant="secondary" size="sm" onClick={addPayment}>
                Add
              </Button>
            </div>
          </div>

          <Input
            value={cart.state.note}
            onChange={(e) => cart.setNote(e.target.value)}
            placeholder="Note"
            aria-label="Sale note"
          />

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={busy || cart.state.lines.length === 0}
              onClick={() => void handleHold()}
            >
              <Pause className="h-4 w-4" />
              Hold
            </Button>
            <Button
              type="button"
              className={cn('flex-1')}
              disabled={busy || cart.state.lines.length === 0}
              onClick={() => void handleComplete()}
            >
              Complete
            </Button>
          </div>
        </PosCartPanel>
      </aside>

      <Dialog open={!!previewUrl} onOpenChange={(o) => !o && setPreviewUrl(null)}>
        <DialogContent className="max-w-lg p-2">
          <DialogHeader>
            <DialogTitle>Product image</DialogTitle>
          </DialogHeader>
          {previewUrl ? (
            <AppImage src={previewUrl} alt="Preview" className="w-full overflow-hidden rounded-xl" />
          ) : null}
        </DialogContent>
      </Dialog>

      {profile?.organization_id ? (
        <QuickAddProductDialog
          open={quickAddOpen}
          onOpenChange={setQuickAddOpen}
          orgId={profile.organization_id}
          branchId={branchId}
          onCreated={() => {
            setCursor(null)
            void loadPage(search, true)
            toast('Product created')
          }}
          onError={(m) => toast(m, 'error')}
        />
      ) : null}
    </div>
  )
}
