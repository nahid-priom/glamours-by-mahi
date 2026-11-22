import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Minus, Plus, Trash2 } from 'lucide-react'
import { EntityCombobox } from '@/components/entity-combobox'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/features/auth/auth-session'
import { simpleAccountingRepository } from '@/features/accounting/repositories/simple-accounting.repository'
import { findVariantByBarcodeExact } from '@/features/pos/repositories/pos.repository'
import { formatBDT } from '@/lib/format'
import {
  accountKindLabel,
  isAccountEligibleForMethod,
  methodCodeToAccountKind,
} from '@/lib/payments/resolve-payment-account'
import { queryKeys } from '@/lib/query/keys'
import { useInvalidateSalesQueries } from '../hooks/use-sales-list'
import { toastRpcError } from '@/lib/errors/rpc-error'
import {
  editSale,
  getSale,
  listPaymentMethods,
  searchCustomers,
} from '../repositories/sales.repository'

const lineSchema = z.object({
  variant_id: z.string().uuid(),
  name: z.string(),
  qty: z.number().positive(),
  unit_price: z.number().min(0),
  line_discount: z.number().min(0).default(0),
})

const paymentSchema = z.object({
  method: z.string().min(1),
  amount: z.number().min(0),
  financial_account_id: z.string().nullable().optional(),
  reference: z.string().nullable().optional(),
})

const editSchema = z.object({
  customer_id: z.string().uuid().nullable(),
  discount: z.number().min(0).default(0),
  tax: z.number().min(0).default(0),
  shipping: z.number().min(0).default(0),
  note: z.string().optional(),
  reason: z.string().min(3, 'Reason is required'),
  items: z.array(lineSchema).min(1, 'At least one item is required'),
  payments: z.array(paymentSchema).min(1, 'At least one payment is required'),
})

type EditForm = z.infer<typeof editSchema>

function lineTotal(qty: number, price: number, discount: number) {
  return Math.max(0, qty * price - discount)
}

export function SaleEditPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { can, activeBranchId } = useAuth()
  const invalidate = useInvalidateSalesQueries()
  const clientTxnKeyRef = useRef(crypto.randomUUID())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [barcode, setBarcode] = useState('')
  const [scanning, setScanning] = useState(false)

  const canEdit = can('sales.update') || can('sales.correct')
  const canPriceOverride = can('pos.price_override') || can('sales.update')

  const saleQuery = useQuery({
    queryKey: queryKeys.sale(id),
    queryFn: () => getSale(id),
    enabled: Boolean(id),
  })

  const methodsQuery = useQuery({
    queryKey: queryKeys.paymentMethods,
    queryFn: listPaymentMethods,
  })

  const saleBranchId = saleQuery.data?.branch_id ?? activeBranchId

  const accountsQuery = useQuery({
    queryKey: [...queryKeys.accounts, 'fa', saleBranchId],
    queryFn: () => simpleAccountingRepository.listFinancialAccounts(saleBranchId),
    enabled: Boolean(saleBranchId),
  })

  const form = useForm<EditForm>({
    resolver: zodResolver(editSchema) as never,
    defaultValues: {
      customer_id: null,
      discount: 0,
      tax: 0,
      shipping: 0,
      note: '',
      reason: '',
      items: [],
      payments: [{ method: 'cash', amount: 0 }],
    },
  })

  const itemsArray = useFieldArray({ control: form.control, name: 'items' })
  const paymentsArray = useFieldArray({ control: form.control, name: 'payments' })

  useEffect(() => {
    const sale = saleQuery.data
    if (!sale) return
    const items = (sale.sale_items ?? [])
      .filter((i) => !i.deleted_at)
      .map((i) => ({
        variant_id: i.variant_id,
        name:
          i.product_variants?.products?.name ||
          i.product_variants?.name ||
          i.product_variants?.sku ||
          'Item',
        qty: Number(i.qty),
        unit_price: Number(i.unit_price),
        line_discount: Number(i.line_discount ?? 0),
      }))
    const payments = (sale.sale_payments ?? [])
      .filter((p) => !p.deleted_at)
      .map((p) => ({
        method: p.method,
        amount: Number(p.amount),
        financial_account_id: p.financial_account_id,
        reference: p.reference,
      }))
    form.reset({
      customer_id: sale.customer_id,
      discount: Number(sale.discount ?? 0),
      tax: Number(sale.tax ?? 0),
      shipping: Number(sale.shipping ?? 0),
      note: sale.note ?? '',
      reason: '',
      items,
      payments: payments.length ? payments : [{ method: 'cash', amount: Number(sale.grand_total) }],
    })
  }, [saleQuery.data, form])

  const watched = form.watch()
  const afterTotals = useMemo(() => {
    const subtotal = (watched.items ?? []).reduce(
      (sum, i) => sum + lineTotal(Number(i.qty || 0), Number(i.unit_price || 0), Number(i.line_discount || 0)),
      0,
    )
    const discount = Number(watched.discount || 0)
    const tax = Number(watched.tax || 0)
    const shipping = Number(watched.shipping || 0)
    const grand = Math.max(0, subtotal - discount + tax + shipping)
    const paid = (watched.payments ?? []).reduce((sum, p) => sum + Number(p.amount || 0), 0)
    return { subtotal, discount, tax, shipping, grand, paid, due: Math.max(0, grand - paid) }
  }, [watched])

  const beforeTotals = useMemo(() => {
    const sale = saleQuery.data
    if (!sale) return null
    return {
      subtotal: Number(sale.subtotal),
      discount: Number(sale.discount),
      grand: Number(sale.grand_total),
      paid: Number(sale.paid_total),
      due: Number(sale.due_total),
      invoice: sale.invoice_no,
    }
  }, [saleQuery.data])

  const effectiveCustomerId = watched.customer_id ?? saleQuery.data?.customer_id ?? null
  const dueRequiresCustomer = afterTotals.due > 0.009 && !effectiveCustomerId

  function isDueMethod(code: string): boolean {
    const m = (methodsQuery.data ?? []).find((x) => x.code === code)
    if (m?.is_due) return true
    const lower = code.trim().toLowerCase()
    return lower === 'due' || lower === 'credit' || lower === 'receivable'
  }

  function validateCorrectionPayments(values: EditForm): string | null {
    const paid = values.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
    const subtotal = values.items.reduce(
      (sum, i) => sum + lineTotal(Number(i.qty || 0), Number(i.unit_price || 0), Number(i.line_discount || 0)),
      0,
    )
    const grand = Math.max(
      0,
      subtotal - Number(values.discount || 0) + Number(values.tax || 0) + Number(values.shipping || 0),
    )
    const due = Math.max(0, grand - paid)
    const customerId = values.customer_id ?? saleQuery.data?.customer_id ?? null
    if (due > 0.009 && !customerId) {
      return 'Due amount requires a customer. Select a customer, or increase payments to cover the total.'
    }
    const accounts = accountsQuery.data ?? []
    for (const p of values.payments) {
      if (Number(p.amount || 0) <= 0) continue
      if (isDueMethod(p.method)) continue
      if (!p.financial_account_id) {
        return `Select a financial account for ${p.method} payment.`
      }
      if (
        !isAccountEligibleForMethod({
          accountId: p.financial_account_id,
          methodCode: p.method,
          branchId: saleBranchId,
          accounts,
        })
      ) {
        return `Account for ${p.method} must be an active ${accountKindLabel(methodCodeToAccountKind(p.method))} account.`
      }
    }
    return null
  }

  const mutation = useMutation({
    mutationFn: (values: EditForm) => {
      const validationError = validateCorrectionPayments(values)
      if (validationError) throw new Error(validationError)
      return editSale({
        sale_id: id,
        reason: values.reason,
        note: values.note || null,
        client_txn_key: clientTxnKeyRef.current,
        customer_id: values.customer_id ?? saleQuery.data?.customer_id ?? null,
        discount: values.discount,
        tax: values.tax,
        shipping: values.shipping,
        items: values.items.map((i) => ({
          variant_id: i.variant_id,
          qty: i.qty,
          unit_price: i.unit_price,
          line_discount: i.line_discount,
        })),
        payments: values.payments.map((p) => ({
          method: p.method,
          amount: p.amount,
          financial_account_id: p.financial_account_id ?? null,
          reference: p.reference ?? null,
        })),
      })
    },
    onSuccess: (result) => {
      toast('Sale corrected')
      invalidate(id)
      if (result.new_sale_id) invalidate(result.new_sale_id)
      navigate(`/sales/${result.new_sale_id ?? id}`)
    },
    onError: (e: Error) => {
      const msg = e.message || ''
      if (/Payments do not cover grand_total/i.test(msg)) {
        toast(
          'Payments do not cover the total. Select a customer for the due amount, or increase payments to match the total.',
          'error',
        )
        return
      }
      toast(msg, 'error')
    },
  })

  const addByBarcode = async () => {
    const branchId = saleQuery.data?.branch_id ?? activeBranchId
    if (!branchId || !barcode.trim()) return
    setScanning(true)
    try {
      const variant = await findVariantByBarcodeExact(barcode.trim(), branchId)
      if (!variant) {
        toast('Barcode not found', 'error')
        return
      }
      const existingIndex = watched.items.findIndex((i) => i.variant_id === variant.variantId)
      if (existingIndex >= 0) {
        const current = watched.items[existingIndex]
        form.setValue(`items.${existingIndex}.qty`, Number(current.qty) + 1)
      } else {
        itemsArray.append({
          variant_id: variant.variantId,
          name: `${variant.productName} · ${variant.variantLabel}`,
          qty: 1,
          unit_price: variant.unitPrice,
          line_discount: 0,
        })
      }
      setBarcode('')
    } catch (e) {
      toastRpcError(toast, e, 'Lookup failed')
    } finally {
      setScanning(false)
    }
  }

  if (!canEdit) {
    return <p className="text-sm text-danger">You do not have permission to edit sales.</p>
  }

  if (saleQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading sale…
      </div>
    )
  }

  if (saleQuery.error || !saleQuery.data) {
    return <p className="text-sm text-danger">Sale not found.</p>
  }

  if (saleQuery.data.status !== 'completed') {
    return (
      <div className="space-y-2">
        <p className="text-sm text-danger">Only completed sales can be corrected.</p>
        <Button asChild variant="outline" size="sm">
          <Link to={`/sales/${id}`}>Back to detail</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl min-w-0 space-y-4">
      <div>
        <p className="text-xs text-text-muted">
          <Link to="/sales" className="hover:text-primary">
            Sales
          </Link>
          {' / '}
          <Link to={`/sales/${id}`} className="hover:text-primary">
            {saleQuery.data.invoice_no}
          </Link>
          {' / Edit'}
        </p>
        <h1 className="text-xl font-bold">Correct sale</h1>
        <p className="text-sm text-text-muted">
          Correction reverses stock, ledger, and remaining commission on the original invoice, then
          creates a linked replacement sale (replacement commission accrues once).
        </p>
      </div>

      <form
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => {
          const validationError = validateCorrectionPayments(values)
          if (validationError) {
            toast(validationError, 'error')
            return
          }
          setConfirmOpen(true)
        })}
      >
        <div className="rounded-xl border border-border bg-white p-4 space-y-3">
          <div className="space-y-1.5">
            <Label>Customer</Label>
            <EntityCombobox
              value={form.watch('customer_id')}
              onChange={(v) => form.setValue('customer_id', v)}
              onSearch={searchCustomers}
              placeholder="Walk-in / customer"
              allowClear
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Invoice discount</Label>
              <Input type="number" min={0} step="0.01" {...form.register('discount', { valueAsNumber: true })} />
            </div>
            <div className="space-y-1.5">
              <Label>Tax</Label>
              <Input type="number" min={0} step="0.01" {...form.register('tax', { valueAsNumber: true })} />
            </div>
            <div className="space-y-1.5">
              <Label>Shipping</Label>
              <Input type="number" min={0} step="0.01" {...form.register('shipping', { valueAsNumber: true })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Note</Label>
            <Input {...form.register('note')} placeholder="Optional note on corrected sale" />
          </div>
          <div className="space-y-1.5">
            <Label>Correction reason *</Label>
            <Input {...form.register('reason')} placeholder="Required audit reason" />
            {form.formState.errors.reason ? (
              <p className="text-xs text-danger">{form.formState.errors.reason.message}</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-white p-4 space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[12rem] flex-1 space-y-1.5">
              <Label>Add item by barcode</Label>
              <Input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void addByBarcode()
                  }
                }}
                placeholder="Scan or type barcode"
              />
            </div>
            <Button type="button" variant="outline" disabled={scanning} onClick={() => void addByBarcode()}>
              {scanning ? 'Looking…' : 'Add'}
            </Button>
          </div>

          {itemsArray.fields.map((field, index) => (
            <div key={field.id} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-12">
              <div className="sm:col-span-4">
                <p className="text-sm font-medium">{form.watch(`items.${index}.name`)}</p>
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Qty</Label>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={() =>
                      form.setValue(
                        `items.${index}.qty`,
                        Math.max(0.01, Number(form.getValues(`items.${index}.qty`)) - 1),
                      )
                    }
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <Input
                    type="number"
                    min={0.01}
                    step="0.01"
                    className="h-8"
                    {...form.register(`items.${index}.qty`, { valueAsNumber: true })}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={() =>
                      form.setValue(
                        `items.${index}.qty`,
                        Number(form.getValues(`items.${index}.qty`)) + 1,
                      )
                    }
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Price</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  disabled={!canPriceOverride}
                  {...form.register(`items.${index}.unit_price`, { valueAsNumber: true })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Line disc.</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  {...form.register(`items.${index}.line_discount`, { valueAsNumber: true })}
                />
              </div>
              <div className="flex items-end justify-between gap-2 sm:col-span-2">
                <p className="text-sm font-medium tabular-nums">
                  {formatBDT(
                    lineTotal(
                      Number(form.watch(`items.${index}.qty`) || 0),
                      Number(form.watch(`items.${index}.unit_price`) || 0),
                      Number(form.watch(`items.${index}.line_discount`) || 0),
                    ),
                  )}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-danger"
                  onClick={() => itemsArray.remove(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {form.formState.errors.items ? (
            <p className="text-xs text-danger">{form.formState.errors.items.message as string}</p>
          ) : null}
        </div>

        <div className="rounded-xl border border-border bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Payments</h2>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                paymentsArray.append({
                  method: methodsQuery.data?.[0]?.code ?? 'cash',
                  amount: 0,
                  financial_account_id: null,
                  reference: null,
                })
              }
            >
              Add payment
            </Button>
          </div>
          <p className="text-xs text-[#6B7280]">
            Correction reverses the original sale and posts a replacement. Historical posted accounts
            stay on the reversed invoice; choose the account for each new money movement below.
          </p>
          {paymentsArray.fields.map((field, index) => {
            const methodCode = watched.payments?.[index]?.method ?? 'cash'
            const dueLine = isDueMethod(methodCode)
            const kind = methodCodeToAccountKind(methodCode)
            const eligible = (accountsQuery.data ?? []).filter(
              (a) =>
                a.is_active &&
                (dueLine || a.account_kind === kind) &&
                (!saleBranchId || a.branch_id === saleBranchId || a.branch_id == null),
            )
            return (
              <div key={field.id} className="space-y-2 rounded-lg border border-border/70 p-2">
                <div className="flex flex-wrap gap-2">
                  <select
                    className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                    {...form.register(`payments.${index}.method`, {
                      onChange: () => {
                        form.setValue(`payments.${index}.financial_account_id`, null)
                      },
                    })}
                  >
                    {(methodsQuery.data ?? [{ code: 'cash', name: 'Cash' }]).map((m) => (
                      <option key={m.code} value={m.code}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    className="w-32"
                    {...form.register(`payments.${index}.amount`, { valueAsNumber: true })}
                  />
                  <Input
                    className="min-w-[8rem] flex-1"
                    placeholder="Reference"
                    {...form.register(`payments.${index}.reference`)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => paymentsArray.remove(index)}
                  >
                    Remove
                  </Button>
                </div>
                {dueLine ? (
                  <p className="text-xs text-[#6B7280]">Due / credit — no cash account required.</p>
                ) : (
                  <div className="space-y-1">
                    <Label className="text-xs">Financial account ({accountKindLabel(kind)})</Label>
                    <select
                      className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                      value={watched.payments?.[index]?.financial_account_id ?? ''}
                      onChange={(e) =>
                        form.setValue(
                          `payments.${index}.financial_account_id`,
                          e.target.value || null,
                        )
                      }
                    >
                      <option value="">Select account…</option>
                      {eligible.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({accountKindLabel(a.account_kind)}) ·{' '}
                          {formatBDT(Number(a.current_balance))}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="rounded-xl border border-border bg-white p-4 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatBDT(afterTotals.subtotal)}</span></div>
          <div className="flex justify-between"><span>Discount</span><span>−{formatBDT(afterTotals.discount)}</span></div>
          <div className="flex justify-between font-semibold"><span>Total</span><span>{formatBDT(afterTotals.grand)}</span></div>
          <div className="flex justify-between"><span>Paid</span><span>{formatBDT(afterTotals.paid)}</span></div>
          <div className="flex justify-between text-danger"><span>Due</span><span>{formatBDT(afterTotals.due)}</span></div>
          {dueRequiresCustomer ? (
            <p className="mt-2 text-xs text-danger">
              Due {formatBDT(afterTotals.due)} needs a customer. Select one above, or raise payments to{' '}
              {formatBDT(afterTotals.grand)}.
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit">Review correction</Button>
          <Button type="button" variant="outline" asChild>
            <Link to={`/sales/${id}`}>Cancel</Link>
          </Button>
        </div>
      </form>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm sale correction</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-text-muted">
              Original invoice <strong>{beforeTotals?.invoice}</strong> will be marked corrected and
              reversed. A new invoice will be created with the values below.
            </p>
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-border p-3">
              <div>
                <p className="text-xs text-text-muted">Before</p>
                <p className="font-semibold">{formatBDT(beforeTotals?.grand ?? 0)}</p>
                <p className="text-xs">Paid {formatBDT(beforeTotals?.paid ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">After</p>
                <p className="font-semibold">{formatBDT(afterTotals.grand)}</p>
                <p className="text-xs">Paid {formatBDT(afterTotals.paid)}</p>
                {afterTotals.due > 0.009 ? (
                  <p className="text-xs text-danger">Due {formatBDT(afterTotals.due)}</p>
                ) : null}
              </div>
            </div>
            {dueRequiresCustomer ? (
              <p className="text-xs text-danger">
                Select a customer for the due amount, or increase payments to cover the total.
              </p>
            ) : null}
            <ul className="space-y-1 rounded-lg border border-border bg-[#F9FAFB] p-3 text-xs">
              {(watched.payments ?? []).map((p, i) => {
                if (Number(p.amount || 0) <= 0) return null
                if (isDueMethod(p.method)) {
                  return (
                    <li key={i}>
                      {p.method}: {formatBDT(p.amount)} (due — no account)
                    </li>
                  )
                }
                const fa = (accountsQuery.data ?? []).find((a) => a.id === p.financial_account_id)
                return (
                  <li key={i}>
                    {p.method}: {formatBDT(p.amount)} → {fa?.name ?? 'No account selected'}
                    {fa ? ` (${accountKindLabel(fa.account_kind)})` : ''}
                  </li>
                )
              })}
            </ul>
            <Button
              className="w-full"
              disabled={mutation.isPending || dueRequiresCustomer}
              onClick={() => mutation.mutate(form.getValues())}
            >
              {mutation.isPending ? 'Submitting…' : 'Confirm correction'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
