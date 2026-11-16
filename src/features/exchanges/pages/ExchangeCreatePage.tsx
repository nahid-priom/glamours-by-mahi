import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { formatBDT } from '@/lib/format'
import { toastRpcError } from '@/lib/errors/rpc-error'
import { ExchangeConfirmStep } from '../components/ExchangeConfirmStep'
import { ExchangeInvoiceStep } from '../components/ExchangeInvoiceStep'
import { ExchangeReplacementsStep } from '../components/ExchangeReplacementsStep'
import { ExchangeReturnsStep } from '../components/ExchangeReturnsStep'
import { ExchangeSummaryRail } from '../components/ExchangeSummaryRail'
import { ExchangeWorkspaceShell } from '../components/ExchangeWorkspaceShell'
import {
  completeExchange,
  getSaleItemsForExchange,
  listFinancialAccounts,
  searchSalesForExchange,
  type ExchangeSaleItemRow,
  type ExchangeSaleSearchRow,
} from '../repositories/exchanges.repository'
import type {
  ExchangeCatalogueVariant,
  ExchangeStep,
  ReplacementLine,
  ReturnLine,
} from '../types'

function itemLabel(item: ExchangeSaleItemRow) {
  const product = item.product_variants?.products?.name ?? 'Product'
  const variant =
    item.product_variants?.name || item.product_variants?.sku || item.variant_id.slice(0, 8)
  return `${product} · ${variant}`
}

export function ExchangeCreatePage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const qc = useQueryClient()

  const [step, setStep] = useState<ExchangeStep>(1)
  const [saleQuery, setSaleQuery] = useState('')
  const [selectedSale, setSelectedSale] = useState<ExchangeSaleSearchRow | null>(null)
  const [returnLines, setReturnLines] = useState<ReturnLine[]>([])
  const [replacements, setReplacements] = useState<ReplacementLine[]>([])
  const [note, setNote] = useState('')
  const [paymentAccountId, setPaymentAccountId] = useState('')
  const [refundAccountId, setRefundAccountId] = useState('')
  const [chargeAsDue, setChargeAsDue] = useState(false)
  const [creditAsAdvance, setCreditAsAdvance] = useState(false)

  const clientTxnKeyRef = useRef(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `ex-${Date.now()}`,
  )

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
    queryFn: listFinancialAccounts,
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
        client_txn_key: clientTxnKeyRef.current,
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
      clientTxnKeyRef.current =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `ex-${Date.now()}`
      await qc.invalidateQueries({ queryKey: ['exchanges'] })
      toast(`Exchange ${res.exchange_no} completed`)
      navigate('/sales/exchanges')
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  function canGoToStep(n: ExchangeStep) {
    if (n === 1) return true
    if (n === 2) return Boolean(selectedSale)
    if (n === 3) return Boolean(selectedSale) && returnLines.length > 0
    if (n === 4) {
      return Boolean(selectedSale) && returnLines.length > 0 && replacements.length > 0
    }
    return false
  }

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

  function addReplacement(variant: ExchangeCatalogueVariant) {
    setReplacements((prev) => {
      const existing = prev.find((p) => p.variantId === variant.id)
      if (existing) {
        return prev.map((p) =>
          p.variantId === variant.id ? { ...p, qty: p.qty + 1 } : p,
        )
      }
      return [
        ...prev,
        {
          key: `${variant.id}-${Date.now()}`,
          variantId: variant.id,
          label: variant.label,
          productName: variant.productName,
          variantLabel: variant.variantLabel,
          thumbnailUrl: variant.thumbnailUrl,
          qty: 1,
          unitPrice: variant.unitPrice,
        },
      ]
    })
  }

  const summary =
    step >= 2 && step !== 3 ? (
      <ExchangeSummaryRail
        returnTotal={returnTotal}
        replacementTotal={replacementTotal}
        difference={difference}
        returnCount={returnLines.length}
        replacementCount={replacements.length}
        footer={
          step === 2 ? (
            <Button
              className="w-full rounded-xl"
              disabled={returnLines.length === 0}
              onClick={() => setStep(3)}
            >
              Continue to replacements
            </Button>
          ) : step === 4 ? (
            <Button
              className="w-full rounded-xl"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending
                ? 'Processing…'
                : `Confirm · ${formatBDT(Math.abs(difference))}`}
            </Button>
          ) : null
        }
      />
    ) : undefined

  return (
    <PermissionGate permission="exchange.create">
      <ExchangeWorkspaceShell
        step={step}
        invoiceNo={selectedSale?.invoice_no}
        canGoToStep={canGoToStep}
        onStepChange={setStep}
        summary={summary}
      >
        {step === 1 ? (
          <ExchangeInvoiceStep
            query={saleQuery}
            onQueryChange={setSaleQuery}
            sales={salesQuery.data ?? []}
            loading={salesQuery.isLoading}
            selectedId={selectedSale?.id}
            onSelect={selectSale}
          />
        ) : null}

        {step === 2 ? (
          <ExchangeReturnsStep
            invoiceNo={selectedSale?.invoice_no}
            items={saleItemsQuery.data ?? []}
            loading={saleItemsQuery.isLoading}
            returnLines={returnLines}
            onToggle={toggleReturnItem}
            onUpdate={updateReturnLine}
            onChangeInvoice={() => setStep(1)}
            onContinue={() => setStep(3)}
          />
        ) : null}

        {step === 3 ? (
          <ExchangeReplacementsStep
            returnTotal={returnTotal}
            replacementTotal={replacementTotal}
            difference={difference}
            replacements={replacements}
            onAdd={addReplacement}
            onAdjustQty={(key, delta) =>
              setReplacements((prev) =>
                prev.map((p) =>
                  p.key === key
                    ? { ...p, qty: Math.max(0.001, p.qty + delta) }
                    : p,
                ),
              )
            }
            onSetQty={(key, qty) =>
              setReplacements((prev) =>
                prev.map((p) =>
                  p.key === key ? { ...p, qty: Math.max(0.001, qty) } : p,
                ),
              )
            }
            onSetPrice={(key, unitPrice) =>
              setReplacements((prev) =>
                prev.map((p) => (p.key === key ? { ...p, unitPrice } : p)),
              )
            }
            onRemove={(key) =>
              setReplacements((prev) => prev.filter((p) => p.key !== key))
            }
            onBack={() => setStep(2)}
            onContinue={() => setStep(4)}
          />
        ) : null}

        {step === 4 ? (
          <ExchangeConfirmStep
            returnTotal={returnTotal}
            replacementTotal={replacementTotal}
            difference={difference}
            hasCustomer={Boolean(selectedSale?.customer_id)}
            chargeAsDue={chargeAsDue}
            creditAsAdvance={creditAsAdvance}
            paymentAccountId={paymentAccountId}
            refundAccountId={refundAccountId}
            note={note}
            accounts={accountsQuery.data ?? []}
            pending={mutation.isPending}
            onChargeAsDueChange={setChargeAsDue}
            onCreditAsAdvanceChange={setCreditAsAdvance}
            onPaymentAccountChange={setPaymentAccountId}
            onRefundAccountChange={setRefundAccountId}
            onNoteChange={setNote}
            onBack={() => setStep(3)}
            onConfirm={() => mutation.mutate()}
          />
        ) : null}
      </ExchangeWorkspaceShell>
    </PermissionGate>
  )
}
