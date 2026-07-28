import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { EntityCombobox } from '@/components/entity-combobox'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { formatBDT } from '@/lib/format'
import { friendlyRpcError } from '@/lib/errors/rpc-error'
import {
  completeExchange,
  getSaleItemsForExchange,
  listFinancialAccounts,
  searchCatalogueVariants,
  searchSalesForExchange,
  type ExchangeSaleItemRow,
  type ExchangeSaleSearchRow,
} from '../repositories/exchanges.repository'

type ReturnLine = {
  saleItemId: string
  variantId: string
  label: string
  maxQty: number
  qty: number
  unitPrice: number
  condition: string
}

type ReplacementLine = {
  key: string
  variantId: string
  label: string
  qty: number
  unitPrice: number
}

const CONDITIONS = [
  { value: 'sellable', label: 'Sellable' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'defective', label: 'Defective' },
  { value: 'quarantine', label: 'Quarantine' },
] as const

function itemLabel(item: ExchangeSaleItemRow) {
  const product = item.product_variants?.products?.name ?? 'Product'
  const variant = item.product_variants?.name || item.product_variants?.sku || item.variant_id.slice(0, 8)
  return `${product} · ${variant}`
}

export function ExchangeCreatePage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const qc = useQueryClient()

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [saleQuery, setSaleQuery] = useState('')
  const [selectedSale, setSelectedSale] = useState<ExchangeSaleSearchRow | null>(null)
  const [returnLines, setReturnLines] = useState<ReturnLine[]>([])
  const [replacements, setReplacements] = useState<ReplacementLine[]>([])
  const [note, setNote] = useState('')
  const [paymentAccountId, setPaymentAccountId] = useState<string>('')
  const [refundAccountId, setRefundAccountId] = useState<string>('')
  const [chargeAsDue, setChargeAsDue] = useState(false)
  const [creditAsAdvance, setCreditAsAdvance] = useState(false)

  const salesQuery = useQuery({
    queryKey: ['exchange-sales-search', saleQuery],
    queryFn: () => searchSalesForExchange(saleQuery),
    enabled: step === 1,
  })

  const saleItemsQuery = useQuery({
    queryKey: ['exchange-sale-items', selectedSale?.id],
    queryFn: () => getSaleItemsForExchange(selectedSale!.id),
    enabled: Boolean(selectedSale?.id) && step >= 2,
  })

  const accountsQuery = useQuery({
    queryKey: ['exchange-financial-accounts'],
    queryFn: () => listFinancialAccounts(),
  })

  const returnTotal = useMemo(
    () => returnLines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0),
    [returnLines],
  )
  const replacementTotal = useMemo(
    () => replacements.reduce((sum, line) => sum + line.qty * line.unitPrice, 0),
    [replacements],
  )
  const difference = Math.round((replacementTotal - returnTotal) * 100) / 100

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedSale) throw new Error('Select a sale invoice first')
      if (returnLines.length === 0) throw new Error('Select at least one return line')
      if (replacements.length === 0) throw new Error('Add at least one replacement')

      if (difference > 0 && !chargeAsDue && !paymentAccountId) {
        throw new Error('Select a payment account or charge as customer due')
      }
      if (difference < 0 && !creditAsAdvance && !refundAccountId) {
        throw new Error('Select a refund account or credit as customer advance')
      }

      return completeExchange({
        sale_id: selectedSale.id,
        client_txn_key: crypto.randomUUID(),
        note: note.trim() || null,
        payment_account_id: difference > 0 && !chargeAsDue ? paymentAccountId : null,
        refund_account_id: difference < 0 && !creditAsAdvance ? refundAccountId : null,
        charge_as_due: difference > 0 ? chargeAsDue : false,
        credit_as_advance: difference < 0 ? creditAsAdvance : false,
        return_items: returnLines.map((line) => ({
          sale_item_id: line.saleItemId,
          variant_id: line.variantId,
          qty: line.qty,
          condition: line.condition,
        })),
        replacement_items: replacements.map((line) => ({
          variant_id: line.variantId,
          qty: line.qty,
          unit_price: line.unitPrice,
        })),
      })
    },
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ['exchanges'] })
      toast(`Exchange ${res.exchange_no} completed`)
      navigate('/sales/exchanges')
    },
    onError: (e: Error) => toast(friendlyRpcError(e), 'error'),
  })

  function selectSale(sale: ExchangeSaleSearchRow) {
    setSelectedSale(sale)
    setReturnLines([])
    setReplacements([])
    setStep(2)
  }

  function toggleReturnItem(item: ExchangeSaleItemRow) {
    if (item.returnable_qty <= 0) return
    setReturnLines((prev) => {
      const existing = prev.find((p) => p.saleItemId === item.id)
      if (existing) return prev.filter((p) => p.saleItemId !== item.id)
      return [
        ...prev,
        {
          saleItemId: item.id,
          variantId: item.variant_id,
          label: itemLabel(item),
          maxQty: item.returnable_qty,
          qty: item.returnable_qty,
          unitPrice: item.unit_price,
          condition: 'sellable',
        },
      ]
    })
  }

  function updateReturnLine(saleItemId: string, patch: Partial<ReturnLine>) {
    setReturnLines((prev) =>
      prev.map((line) => {
        if (line.saleItemId !== saleItemId) return line
        const next = { ...line, ...patch }
        next.qty = Math.min(Math.max(0.001, next.qty), next.maxQty)
        return next
      }),
    )
  }

  return (
    <PermissionGate permission="exchange.create">
      <div className="mx-auto w-full max-w-3xl min-w-0 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[#111827]">New product exchange</h1>
            <p className="text-sm text-[#6B7280]">
              Step {step} of 4 — search invoice, pick returns, add replacements, confirm.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/sales/exchanges">Back to list</Link>
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {[1, 2, 3, 4].map((n) => (
            <span
              key={n}
              className={
                n === step
                  ? 'rounded-full bg-[#111827] px-2.5 py-1 text-white'
                  : n < step
                    ? 'rounded-full bg-[#E5E7EB] px-2.5 py-1 text-[#111827]'
                    : 'rounded-full border border-border px-2.5 py-1 text-[#6B7280]'
              }
            >
              {n === 1
                ? 'Invoice'
                : n === 2
                  ? 'Returns'
                  : n === 3
                    ? 'Replacements'
                    : 'Confirm'}
            </span>
          ))}
        </div>

        {step === 1 ? (
          <section className="space-y-3 rounded-xl border border-border bg-white p-4">
            <Label htmlFor="invoice-search">Search invoice</Label>
            <Input
              id="invoice-search"
              value={saleQuery}
              onChange={(e) => setSaleQuery(e.target.value)}
              placeholder="Invoice number…"
              className="rounded-xl"
            />
            <div className="divide-y rounded-xl border border-border">
              {(salesQuery.data ?? []).map((sale) => (
                <button
                  key={sale.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-[#F9FAFB]"
                  onClick={() => selectSale(sale)}
                >
                  <span>
                    <span className="font-medium">{sale.invoice_no}</span>
                    <span className="mt-0.5 block text-xs text-[#6B7280]">
                      {sale.customers?.name ?? 'Walk-in'} ·{' '}
                      {new Date(sale.created_at).toLocaleDateString()}
                    </span>
                  </span>
                  <span className="font-medium">{formatBDT(sale.grand_total)}</span>
                </button>
              ))}
              {!salesQuery.isLoading && (salesQuery.data?.length ?? 0) === 0 ? (
                <p className="p-4 text-sm text-[#6B7280]">No completed sales found.</p>
              ) : null}
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="space-y-3 rounded-xl border border-border bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-medium">{selectedSale?.invoice_no}</p>
                <p className="text-xs text-[#6B7280]">Select lines to return</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setStep(1)}>
                Change invoice
              </Button>
            </div>

            {saleItemsQuery.isLoading ? (
              <p className="text-sm text-[#6B7280]">Loading sale items…</p>
            ) : (
              <div className="space-y-2">
                {(saleItemsQuery.data ?? []).map((item) => {
                  const selected = returnLines.find((l) => l.saleItemId === item.id)
                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-border p-3 text-sm"
                    >
                      <label className="flex cursor-pointer items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={Boolean(selected)}
                          disabled={item.returnable_qty <= 0}
                          onChange={() => toggleReturnItem(item)}
                        />
                        <span className="flex-1">
                          <span className="font-medium">{itemLabel(item)}</span>
                          <span className="mt-0.5 block text-xs text-[#6B7280]">
                            Sold {item.qty} · returnable {item.returnable_qty} ·{' '}
                            {formatBDT(item.unit_price)}
                          </span>
                        </span>
                      </label>
                      {selected ? (
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <div>
                            <Label>Qty</Label>
                            <Input
                              type="number"
                              min={0.001}
                              max={selected.maxQty}
                              step="any"
                              value={selected.qty}
                              onChange={(e) =>
                                updateReturnLine(item.id, {
                                  qty: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label>Condition</Label>
                            <select
                              className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                              value={selected.condition}
                              onChange={(e) =>
                                updateReturnLine(item.id, { condition: e.target.value })
                              }
                            >
                              {CONDITIONS.map((c) => (
                                <option key={c.value} value={c.value}>
                                  {c.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                disabled={returnLines.length === 0}
                onClick={() => setStep(3)}
              >
                Continue
              </Button>
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="space-y-3 rounded-xl border border-border bg-white p-4">
            <p className="text-sm text-[#6B7280]">
              Return total {formatBDT(returnTotal)}. Add catalogue replacements.
            </p>

            <EntityCombobox
              value={null}
              onChange={(id, option) => {
                if (!id || !option) return
                const unitPrice =
                  'unitPrice' in option &&
                  typeof (option as { unitPrice?: number }).unitPrice === 'number'
                    ? (option as { unitPrice: number }).unitPrice
                    : 0
                setReplacements((prev) => [
                  ...prev,
                  {
                    key: `${id}-${Date.now()}`,
                    variantId: id,
                    label: option.label,
                    qty: 1,
                    unitPrice,
                  },
                ])
              }}
              onSearch={async (q) => {
                const rows = await searchCatalogueVariants(q)
                return rows.map((r) => ({
                  id: r.id,
                  label: r.label,
                  description: `${r.description} · ${formatBDT(r.unitPrice)}`,
                  unitPrice: r.unitPrice,
                }))
              }}
              placeholder="Search catalogue…"
              allowClear={false}
            />

            <div className="space-y-2">
              {replacements.map((line) => (
                <div
                  key={line.key}
                  className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[1fr_5rem_7rem_auto]"
                >
                  <div className="text-sm font-medium">{line.label}</div>
                  <Input
                    type="number"
                    min={0.001}
                    step="any"
                    value={line.qty}
                    onChange={(e) =>
                      setReplacements((prev) =>
                        prev.map((p) =>
                          p.key === line.key
                            ? { ...p, qty: Number(e.target.value) || 0 }
                            : p,
                        ),
                      )
                    }
                  />
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={line.unitPrice}
                    onChange={(e) =>
                      setReplacements((prev) =>
                        prev.map((p) =>
                          p.key === line.key
                            ? { ...p, unitPrice: Number(e.target.value) || 0 }
                            : p,
                        ),
                      )
                    }
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setReplacements((prev) => prev.filter((p) => p.key !== line.key))
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
              {replacements.length === 0 ? (
                <p className="text-sm text-[#6B7280]">No replacements yet.</p>
              ) : null}
            </div>

            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button disabled={replacements.length === 0} onClick={() => setStep(4)}>
                Review difference
              </Button>
            </div>
          </section>
        ) : null}

        {step === 4 ? (
          <section className="space-y-4 rounded-xl border border-border bg-white p-4">
            <div className="space-y-1 text-sm">
              <p>
                Returns: <span className="font-medium">{formatBDT(returnTotal)}</span>
              </p>
              <p>
                Replacements:{' '}
                <span className="font-medium">{formatBDT(replacementTotal)}</span>
              </p>
              <p className="text-base">
                Difference:{' '}
                <span className="font-semibold">
                  {difference > 0 ? 'Customer pays ' : difference < 0 ? 'Refund ' : ''}
                  {formatBDT(Math.abs(difference))}
                </span>
              </p>
            </div>

            {difference > 0 ? (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={chargeAsDue}
                    onChange={(e) => setChargeAsDue(e.target.checked)}
                    disabled={!selectedSale?.customer_id}
                  />
                  Charge as customer due
                </label>
                {!chargeAsDue ? (
                  <div>
                    <Label>Payment account</Label>
                    <select
                      className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                      value={paymentAccountId}
                      onChange={(e) => setPaymentAccountId(e.target.value)}
                    >
                      <option value="">Select account…</option>
                      {(accountsQuery.data ?? []).map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
            ) : null}

            {difference < 0 ? (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={creditAsAdvance}
                    onChange={(e) => setCreditAsAdvance(e.target.checked)}
                    disabled={!selectedSale?.customer_id}
                  />
                  Credit as customer advance
                </label>
                {!creditAsAdvance ? (
                  <div>
                    <Label>Refund account</Label>
                    <select
                      className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                      value={refundAccountId}
                      onChange={(e) => setRefundAccountId(e.target.value)}
                    >
                      <option value="">Select account…</option>
                      {(accountsQuery.data ?? []).map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div>
              <Label htmlFor="exchange-note">Note</Label>
              <Input
                id="exchange-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note"
                className="mt-1 rounded-xl"
              />
            </div>

            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setStep(3)}>
                Back
              </Button>
              <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
                {mutation.isPending ? 'Processing…' : 'Confirm exchange'}
              </Button>
            </div>
          </section>
        ) : null}
      </div>
    </PermissionGate>
  )
}
