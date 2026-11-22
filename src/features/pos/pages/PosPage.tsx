import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Pause, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { MissingBranchAccountsNotice } from '@/components/payments/ResolvedPaymentAccountField'
import { useAuth } from '@/features/auth/auth-session'
import { formatBDT } from '@/lib/format'
import { invalidateSaleCompletionCaches } from '@/lib/mutations/party-finance-cache'
import { queryKeys } from '@/lib/query/keys'
import { cn } from '@/lib/utils'
import type { AccountKind, FinancialAccountRow } from '@/features/accounting/repositories/simple-accounting.repository'
import { assertSaleReady, canAddQty } from '../cart-utils'
import {
  PosBarcodeInput,
  type PosBarcodeInputHandle,
} from '../components/PosBarcodeInput'
import { PosCartPanel } from '../components/PosCartPanel'
import { PosCustomerSelect } from '../components/PosCustomerSelect'
import {
  PosMobileCartBar,
  PosMobileCartSheet,
} from '../components/PosMobileCartSheet'
import {
  PosPostSalePreviewDialog,
  type CompletedSalePreview,
} from '../components/PosPostSalePreviewDialog'
import { PosProductCard } from '../components/PosProductCard'
import { PosProductPreviewDialog } from '../components/PosProductPreviewDialog'
import { usePosBarcodeLookup } from '../hooks/use-pos-barcode-lookup'
import {
  usePosCatalogue,
  usePosFinancialAccounts,
} from '../hooks/use-pos-catalogue'
import {
  completeSale,
  deleteHeldSale,
  getHeldSaleForResume,
  saveHeldSale,
} from '../repositories/pos.repository'
import type { PosVariant } from '../types'
import { usePosCart } from '../use-pos-cart'
import { toastRpcError } from '@/lib/errors/rpc-error'

/** Map financial account kind → sale payment method code for RPC. */
function methodFromAccountKind(kind: AccountKind): string {
  switch (kind) {
    case 'cash':
      return 'cash'
    case 'bank':
      return 'bank'
    case 'mobile_money':
      return 'bkash'
    default:
      return 'other'
  }
}

function playScanSuccess() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.value = 0.04
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
    osc.stop(ctx.currentTime + 0.09)
    window.setTimeout(() => void ctx.close(), 120)
  } catch {
    /* non-blocking */
  }
}

export function PosPage() {
  const { activeBranchId, profile, can } = useAuth()
  const { toast } = useToast()
  const qc = useQueryClient()
  const cart = usePosCart()
  const barcodeRef = useRef<PosBarcodeInputHandle>(null)
  const clientTxnKeyRef = useRef(crypto.randomUUID())
  const resumedHeldSaleIdRef = useRef<string | null>(null)
  const restoreCartRef = useRef(cart.restore)
  restoreCartRef.current = cart.restore
  const [searchParams, setSearchParams] = useSearchParams()
  const resumeId = searchParams.get('resume')

  const branchId = activeBranchId
  const canDiscount = can('pos.discount')
  const canReadCustomers = can('customers.read')
  const canCreateCustomers = can('customers.manage')

  const [busy, setBusy] = useState(false)
  const [mobileCartOpen, setMobileCartOpen] = useState(false)
  /** Selected financial account id, or `null` for Due / Credit. */
  const [payAccountId, setPayAccountId] = useState<string | null>(null)
  const payAccountDefaultedRef = useRef(false)
  const [payAmount, setPayAmount] = useState('')
  const [completedPreview, setCompletedPreview] = useState<CompletedSalePreview | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [productPreview, setProductPreview] = useState<PosVariant | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [catalogSearch, setCatalogSearch] = useState('')
  const previewTriggerRef = useRef<HTMLElement | null>(null)

  const catalogue = usePosCatalogue(branchId)
  const { lookup, loading: scanLoading } = usePosBarcodeLookup(branchId)
  const accountsQuery = usePosFinancialAccounts(branchId)

  const variants = useMemo(
    () => catalogue.data?.pages.flatMap((p) => p.items) ?? [],
    [catalogue.data],
  )

  const categories = useMemo(() => {
    const map = new Map<string, string>()
    for (const v of variants) {
      if (v.categoryId && v.categoryName) map.set(v.categoryId, v.categoryName)
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [variants])

  const visibleVariants = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase()
    return variants.filter((v) => {
      if (categoryFilter !== 'all' && v.categoryId !== categoryFilter) return false
      if (!q) return true
      return (
        v.productName.toLowerCase().includes(q) ||
        v.sku.toLowerCase().includes(q) ||
        (v.barcode ?? '').toLowerCase().includes(q) ||
        v.variantLabel.toLowerCase().includes(q)
      )
    })
  }, [variants, categoryFilter, catalogSearch])

  const posAccounts = useMemo((): FinancialAccountRow[] => {
    return (accountsQuery.data ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      account_kind: (a.account_kind as AccountKind) ?? 'other',
      branch_id: a.branch_id ?? null,
      opening_balance: 0,
      current_balance: 0,
      is_default: Boolean(a.is_default),
      is_active: true,
      chart_account_id: null,
    }))
  }, [accountsQuery.data])

  useEffect(() => {
    if (!branchId || !resumeId) return

    let cancelled = false
    void (async () => {
      setBusy(true)
      try {
        const restored = await getHeldSaleForResume(resumeId, branchId)
        if (cancelled) return
        restoreCartRef.current(restored)
        resumedHeldSaleIdRef.current = restored.heldSaleId
        toast('Held cart restored')
        setSearchParams({}, { replace: true })
        setMobileCartOpen(true)
      } catch (e) {
        if (!cancelled) {
          toastRpcError(toast, e, 'Could not restore held sale')
          setSearchParams({}, { replace: true })
        }
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [branchId, resumeId, toast, setSearchParams])

  useEffect(() => {
    if (accountsQuery.isLoading) return
    if (!payAccountDefaultedRef.current) {
      const def = posAccounts.find((a) => a.is_default) ?? posAccounts[0]
      setPayAccountId(def?.id ?? null)
      payAccountDefaultedRef.current = true
      return
    }
    if (payAccountId !== null && !posAccounts.some((a) => a.id === payAccountId)) {
      const def = posAccounts.find((a) => a.is_default) ?? posAccounts[0]
      setPayAccountId(def?.id ?? null)
    }
  }, [accountsQuery.isLoading, posAccounts, payAccountId])

  const refocusBarcode = useCallback(() => {
    barcodeRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!mobileCartOpen) refocusBarcode()
  }, [mobileCartOpen, refocusBarcode])

  const tryAddVariant = useCallback(
    (variant: PosVariant): 'added' | 'stock' => {
      const existing = cart.state.lines.find((l) => l.variantId === variant.variantId)
      if (existing ? !canAddQty(existing, 1) : variant.availableStock <= 0) {
        return 'stock'
      }
      cart.addVariant(variant, 1)
      return 'added'
    },
    [cart],
  )

  /** Single shared cart-add path used by the card button, preview and barcode scanner. */
  const addProductToCart = useCallback(
    (variant: PosVariant, opts?: { refocus?: boolean }): 'added' | 'stock' => {
      const existingQty =
        cart.state.lines.find((l) => l.variantId === variant.variantId)?.qty ?? 0
      const outcome = tryAddVariant(variant)
      if (outcome === 'stock') {
        toast('Stock limit reached', 'error')
        return 'stock'
      }
      const nextQty = Math.min(existingQty + 1, variant.availableStock)
      toast(`${variant.productName} · qty ${nextQty}`)
      if (opts?.refocus) refocusBarcode()
      return 'added'
    },
    [cart.state.lines, tryAddVariant, toast, refocusBarcode],
  )

  const openProductPreview = useCallback((variant: PosVariant, trigger: HTMLElement | null) => {
    previewTriggerRef.current = trigger
    setProductPreview(variant)
  }, [])

  const previewInCartQty = useMemo(() => {
    if (!productPreview) return 0
    return cart.state.lines.find((l) => l.variantId === productPreview.variantId)?.qty ?? 0
  }, [productPreview, cart.state.lines])

  const handleScan = useCallback(
    async (code: string) => {
      if (!branchId) return
      const result = await lookup(code)

      if (result.status === 'empty') {
        refocusBarcode()
        return
      }

      if (result.status === 'not_found') {
        toast('Product not found', 'error')
        barcodeRef.current?.setValue(result.code)
        barcodeRef.current?.focusAndSelect()
        return
      }

      if (result.status === 'out_of_stock') {
        toast('Out of stock', 'error')
        barcodeRef.current?.setValue(result.variant.barcode ?? code)
        barcodeRef.current?.focusAndSelect()
        return
      }

      const existingQty =
        cart.state.lines.find((l) => l.variantId === result.variant.variantId)?.qty ?? 0
      const outcome = tryAddVariant(result.variant)
      if (outcome === 'stock') {
        toast('Out of stock', 'error')
        barcodeRef.current?.setValue(result.variant.barcode ?? code)
        barcodeRef.current?.focusAndSelect()
        return
      }

      const nextQty = Math.min(existingQty + 1, result.variant.availableStock)
      playScanSuccess()
      toast(`${result.variant.productName} · qty ${nextQty}`)
      barcodeRef.current?.clear()
      refocusBarcode()
    },
    [branchId, lookup, tryAddVariant, cart.state.lines, toast, refocusBarcode],
  )

  const withFocus = useCallback(
    <T extends unknown[]>(fn: (...args: T) => void) =>
      (...args: T) => {
        fn(...args)
        refocusBarcode()
      },
    [refocusBarcode],
  )

  const remainingDue = cart.totals.due

  /** Keep the typed amount within [0, remaining due] — never allow overpayment. */
  const clampPayAmount = useCallback(
    (raw: string): string => {
      if (raw === '') return ''
      const n = Number(raw)
      if (!Number.isFinite(n) || n < 0) return ''
      if (n > remainingDue) return String(remainingDue)
      return raw
    },
    [remainingDue],
  )

  const addPayment = () => {
    const amount = Math.min(Number(payAmount), remainingDue)
    if (!(amount > 0)) {
      toast('Enter a valid payment amount', 'error')
      return
    }
    if (payAccountId === null) {
      if (cart.state.payments.some((p) => /due|credit|receivable/i.test(p.method))) {
        toast('Due / Credit can only be added once', 'error')
        return
      }
      cart.setPayments([...cart.state.payments, { method: 'due', amount }])
    } else {
      if (cart.state.payments.some((p) => p.financialAccountId === payAccountId)) {
        toast('This account is already added', 'error')
        return
      }
      const account = posAccounts.find((a) => a.id === payAccountId)
      if (!account) {
        toast('Select a payment account', 'error')
        return
      }
      cart.setPayments([
        ...cart.state.payments,
        {
          method: methodFromAccountKind(account.account_kind),
          amount,
          financialAccountId: account.id,
        },
      ])
    }
    setPayAmount('')
    refocusBarcode()
  }

  const handleHold = async () => {
    if (!branchId || !profile) return
    setBusy(true)
    try {
      const payload = cart.serializeHold(branchId)
      await saveHeldSale(payload, profile.organization_id, profile.id)
      if (resumedHeldSaleIdRef.current) {
        try {
          await deleteHeldSale(resumedHeldSaleIdRef.current)
          void qc.invalidateQueries({ queryKey: queryKeys.heldSales })
        } catch {
          /* non-blocking */
        }
        resumedHeldSaleIdRef.current = null
      }
      toast('Sale held')
      cart.reset()
      clientTxnKeyRef.current = crypto.randomUUID()
      refocusBarcode()
    } catch (e) {
      toastRpcError(toast, e, 'Could not hold sale')
    } finally {
      setBusy(false)
      refocusBarcode()
    }
  }

  const handleComplete = async () => {
    if (!branchId || busy) return
    setBusy(true)
    try {
      cart.assertReady()
      const { state, totals } = cart
      let payments = state.payments
      if (payments.length === 0 && totals.grandTotal > 0) {
        if (payAccountId === null) {
          payments = [{ method: 'due', amount: totals.grandTotal }]
        } else {
          const account =
            posAccounts.find((a) => a.id === payAccountId) ??
            posAccounts.find((a) => a.is_default) ??
            posAccounts[0]
          payments = [
            {
              method: methodFromAccountKind(account?.account_kind ?? 'cash'),
              amount: totals.grandTotal,
              financialAccountId: account?.id,
            },
          ]
        }
      }
      assertSaleReady({ ...state, payments })

      const result = (await completeSale({
        branch_id: branchId,
        customer_id: state.customerId,
        client_txn_key: clientTxnKeyRef.current,
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
      })) as { sale_id?: string; invoice_no?: string } | null

      const saleId = result?.sale_id
      if (!saleId) throw new Error('Sale completed but no sale_id returned')

      await invalidateSaleCompletionCaches(qc, {
        customerId: state.customerId,
        branchId,
      })

      if (resumedHeldSaleIdRef.current) {
        const heldId = resumedHeldSaleIdRef.current
        resumedHeldSaleIdRef.current = null
        try {
          await deleteHeldSale(heldId)
          void qc.invalidateQueries({ queryKey: queryKeys.heldSales })
        } catch {
          /* non-blocking */
        }
      }

      const invoiceLabel = result?.invoice_no ? ` — Invoice ${result.invoice_no}` : ''
      toast(`Sale completed successfully${invoiceLabel}`)
      cart.reset()
      clientTxnKeyRef.current = crypto.randomUUID()
      setMobileCartOpen(false)
      setCompletedPreview({
        saleId,
        invoiceNo: result?.invoice_no ?? null,
      })
      setPreviewOpen(true)
    } catch (e) {
      toastRpcError(toast, e, 'Could not complete sale')
    } finally {
      setBusy(false)
      refocusBarcode()
    }
  }

  const closePreview = () => {
    setPreviewOpen(false)
    setCompletedPreview(null)
    refocusBarcode()
  }

  const startNewSaleFromPreview = () => {
    setPreviewOpen(false)
    setCompletedPreview(null)
    cart.reset()
    clientTxnKeyRef.current = crypto.randomUUID()
    refocusBarcode()
  }

  const checkoutDisabled = busy || cart.state.lines.length === 0

  const fullyPaid = cart.state.lines.length > 0 && remainingDue <= 0
  const paymentLabel = (p: { method: string; financialAccountId?: string }) => {
    if (!p.financialAccountId && /due|credit|receivable/i.test(p.method)) {
      return 'Due / Credit'
    }
    return posAccounts.find((a) => a.id === p.financialAccountId)?.name ?? p.method
  }

  const paymentSection = (
    <>
      <div className="space-y-1 rounded-xl border border-border bg-white p-1.5">
        {cart.state.payments.map((p, i) => (
          <div
            key={`${p.financialAccountId ?? p.method}-${i}`}
            className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-0.5 text-xs"
          >
            <span>
              {paymentLabel(p)} · <span className="tabular-nums">{formatBDT(p.amount)}</span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-xs text-danger"
              onClick={withFocus(() =>
                cart.setPayments(cart.state.payments.filter((_, j) => j !== i)),
              )}
            >
              Remove
            </Button>
          </div>
        ))}

        {!fullyPaid ? (
          <>
            {!accountsQuery.isLoading && posAccounts.length === 0 ? (
              <MissingBranchAccountsNotice className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900" />
            ) : null}
            <div
              className="flex flex-nowrap items-center gap-1 overflow-x-auto pb-0.5"
              role="radiogroup"
              aria-label="Payment account"
            >
              {posAccounts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-checked={payAccountId === a.id}
                  className={cn(
                    'h-7 shrink-0 rounded-full border px-2.5 text-[11px] font-medium transition-colors',
                    payAccountId === a.id
                      ? 'border-primary bg-primary text-white'
                      : 'border-border bg-white text-text-primary hover:bg-slate-50',
                  )}
                  onClick={() => setPayAccountId(a.id)}
                >
                  {a.name}
                </button>
              ))}
              <button
                type="button"
                role="radio"
                aria-checked={payAccountId === null}
                className={cn(
                  'h-7 shrink-0 rounded-full border px-2.5 text-[11px] font-medium transition-colors',
                  payAccountId === null
                    ? 'border-primary bg-primary text-white'
                    : 'border-border bg-white text-text-primary hover:bg-slate-50',
                )}
                onClick={() => setPayAccountId(null)}
              >
                Due / Credit
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="relative min-w-0 flex-1">
                <Input
                  type="number"
                  min={0}
                  max={remainingDue}
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(clampPayAmount(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addPayment()
                    }
                  }}
                  placeholder="Amount"
                  className="h-8 pr-14 text-xs"
                  aria-label="Payment amount"
                  disabled={cart.state.lines.length === 0}
                />
                <button
                  type="button"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
                  onClick={() => setPayAmount(String(remainingDue))}
                  disabled={remainingDue <= 0}
                  aria-label="Pay exact due amount"
                >
                  Exact
                </button>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="h-8 shrink-0 px-3 text-xs"
                onClick={addPayment}
                disabled={!(Number(payAmount) > 0)}
              >
                Add
              </Button>
            </div>
          </>
        ) : null}
      </div>

      <Input
        value={cart.state.note}
        onChange={(e) => cart.setNote(e.target.value)}
        placeholder="Note"
        aria-label="Sale note"
        className="h-8 text-xs"
      />

      <div className="flex gap-1.5">
        <Button
          type="button"
          variant="outline"
          className="h-9 flex-1 text-sm"
          disabled={checkoutDisabled}
          onClick={() => void handleHold()}
        >
          <Pause className="h-3.5 w-3.5" />
          Hold
        </Button>
        <Button
          type="button"
          className="h-9 flex-1 bg-[#E11D48] text-sm hover:bg-[#be123c]"
          disabled={checkoutDisabled}
          onClick={() => void handleComplete()}
          aria-keyshortcuts="F8"
        >
          {busy
            ? 'Posting…'
            : cart.state.payments.length === 0 && cart.totals.grandTotal > 0
              ? `Pay & Complete · ${formatBDT(cart.totals.grandTotal)}`
              : 'Pay & Complete (F8)'}
        </Button>
      </div>
    </>
  )

  const cartBody = (
    <PosCartPanel
      className="min-h-0 flex-1"
      lines={cart.state.lines}
      totals={cart.totals}
      showDiscount={canDiscount}
      onAdjustQty={withFocus(cart.adjustLineQty)}
      onSetLineDiscount={canDiscount ? withFocus(cart.setLineDiscount) : undefined}
      onRemove={withFocus(cart.removeLine)}
    >
      {paymentSection}
    </PosCartPanel>
  )

  if (!branchId) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-text-muted">
        Select an active branch to use POS.
      </div>
    )
  }

  return (
    <div
      className={cn(
        'grid h-full min-h-0 gap-3 overflow-hidden',
        'grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_420px]',
        'pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:pb-0',
      )}
    >
      <section className="flex h-full min-h-0 min-w-0 flex-col gap-2">
        <PosBarcodeInput
          ref={barcodeRef}
          onScan={handleScan}
          disabled={busy}
          loading={scanLoading}
        />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            className="h-9 sm:max-w-xs"
            placeholder="Search name, SKU, barcode…"
            value={catalogSearch}
            onChange={(e) => setCatalogSearch(e.target.value)}
            aria-label="Filter catalogue"
          />
          {categories.length > 0 ? (
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              <button
                type="button"
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1 text-xs font-medium',
                  categoryFilter === 'all'
                    ? 'border-[#E11D48] bg-[#FFF1F2] text-[#E11D48]'
                    : 'border-border bg-white text-[#374151]',
                )}
                onClick={() => {
                  setCategoryFilter('all')
                  setCatalogSearch('')
                }}
              >
                All Products
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={cn(
                    'shrink-0 rounded-full border px-3 py-1 text-xs font-medium',
                    categoryFilter === c.id
                      ? 'border-[#E11D48] bg-[#FFF1F2] text-[#E11D48]'
                      : 'border-border bg-white text-[#374151]',
                  )}
                  onClick={() => {
                    setCategoryFilter(c.id)
                    setCatalogSearch('')
                  }}
                >
                  {c.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="grid grid-cols-2 items-stretch gap-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {catalogue.isLoading
              ? Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-[292px] w-full rounded-xl" />
                ))
              : visibleVariants.map((v) => (
                  <PosProductCard
                    key={v.variantId}
                    variant={v}
                    onAdd={(variant) => addProductToCart(variant, { refocus: true })}
                    onPreview={openProductPreview}
                  />
                ))}
          </div>

          {!catalogue.isLoading && variants.length === 0 ? (
            <p className="py-12 text-center text-sm text-text-muted">No products in catalogue</p>
          ) : null}
          {!catalogue.isLoading && variants.length > 0 && visibleVariants.length === 0 ? (
            <p className="py-12 text-center text-sm text-text-muted">No products match this filter</p>
          ) : null}

          {catalogue.hasNextPage ? (
            <div className="py-3 text-center">
              <Button
                type="button"
                variant="outline"
                disabled={catalogue.isFetchingNextPage}
                onClick={() => void catalogue.fetchNextPage()}
              >
                {catalogue.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      <aside className="hidden h-full min-h-0 overflow-hidden lg:flex">
        <div className="flex h-full min-h-0 w-full flex-col rounded-2xl border border-border bg-white p-3">
          <div className="mb-2 flex shrink-0 items-center gap-2 text-sm font-semibold">
            <ShoppingCart className="h-4 w-4" />
            Cart
            {cart.state.lines.length > 0 ? (
              <span className="text-xs font-normal text-text-muted">
                ({cart.state.lines.reduce((s, l) => s + l.qty, 0)})
              </span>
            ) : null}
          </div>

          {canReadCustomers ? (
            <PosCustomerSelect
              value={cart.state.customerId}
              onChange={(id, label) => cart.setCustomer(id, label)}
              organizationId={profile?.organization_id ?? ''}
              branchId={branchId}
              createdBy={profile?.id ?? null}
              canCreate={canCreateCustomers}
              onAfterResolve={refocusBarcode}
              className="mb-2"
            />
          ) : null}

          {canDiscount ? (
            <Input
              type="number"
              min={0}
              step="0.01"
              value={cart.state.invoiceDiscount || ''}
              placeholder="Invoice discount"
              aria-label="Invoice discount"
              className="mb-2 shrink-0"
              onChange={(e) => cart.setInvoiceDiscount(Number(e.target.value) || 0)}
              onBlur={refocusBarcode}
            />
          ) : null}

          {cartBody}
        </div>
      </aside>

      <PosMobileCartBar
        itemCount={cart.state.lines.reduce((s, l) => s + l.qty, 0)}
        total={cart.totals.grandTotal}
        onOpen={() => setMobileCartOpen(true)}
      />

      <PosMobileCartSheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
        <div className="flex h-full min-h-0 flex-col">
          {canReadCustomers ? (
            <PosCustomerSelect
              value={cart.state.customerId}
              onChange={(id, label) => cart.setCustomer(id, label)}
              organizationId={profile?.organization_id ?? ''}
              branchId={branchId}
              createdBy={profile?.id ?? null}
              canCreate={canCreateCustomers}
              className="mb-2"
            />
          ) : null}
          {canDiscount ? (
            <Input
              type="number"
              min={0}
              step="0.01"
              value={cart.state.invoiceDiscount || ''}
              placeholder="Invoice discount"
              aria-label="Invoice discount"
              className="mb-2 shrink-0"
              onChange={(e) => cart.setInvoiceDiscount(Number(e.target.value) || 0)}
            />
          ) : null}
          {cartBody}
        </div>
      </PosMobileCartSheet>

      <PosProductPreviewDialog
        variant={productPreview}
        open={Boolean(productPreview)}
        onOpenChange={(next) => {
          if (!next) setProductPreview(null)
        }}
        onAdd={(variant) => addProductToCart(variant, { refocus: false })}
        inCartQty={previewInCartQty}
        restoreFocusRef={previewTriggerRef}
      />

      <PosPostSalePreviewDialog
        preview={completedPreview}
        open={previewOpen}
        onClose={closePreview}
        onNewSale={startNewSaleFromPreview}
      />
    </div>
  )
}
