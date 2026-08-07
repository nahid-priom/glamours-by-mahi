import { Minus, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatBDT } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ExchangeSaleItemRow } from '../repositories/exchanges.repository'
import { EXCHANGE_CONDITIONS, type ReturnLine } from '../types'

function itemLabel(item: ExchangeSaleItemRow) {
  const product = item.product_variants?.products?.name ?? 'Product'
  const variant =
    item.product_variants?.name || item.product_variants?.sku || item.variant_id.slice(0, 8)
  return `${product} · ${variant}`
}

type Props = {
  invoiceNo?: string
  items: ExchangeSaleItemRow[]
  loading: boolean
  returnLines: ReturnLine[]
  onToggle: (item: ExchangeSaleItemRow) => void
  onUpdate: (saleItemId: string, patch: Partial<ReturnLine>) => void
  onChangeInvoice: () => void
  onContinue: () => void
}

export function ExchangeReturnsStep({
  invoiceNo,
  items,
  loading,
  returnLines,
  onToggle,
  onUpdate,
  onChangeInvoice,
  onContinue,
}: Props) {
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-white p-3 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Select returns</h2>
          <p className="text-xs text-text-muted">
            {invoiceNo ? `${invoiceNo} · ` : ''}Pick lines and condition for each return.
          </p>
        </div>
        <Button variant="outline" size="sm" className="rounded-xl" onClick={onChangeInvoice}>
          Change invoice
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const selected = returnLines.find((l) => l.saleItemId === item.id)
            const disabled = item.returnable_qty <= 0
            return (
              <div
                key={item.id}
                className={cn(
                  'rounded-xl border border-border p-3 transition-shadow',
                  selected && 'ring-2 ring-primary/30',
                  disabled && 'opacity-60',
                )}
              >
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onToggle(item)}
                  className="flex w-full items-start gap-3 text-left"
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold',
                      selected
                        ? 'border-primary bg-primary text-white'
                        : 'border-border bg-white text-transparent',
                    )}
                    aria-hidden
                  >
                    ✓
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-text-primary">
                      {itemLabel(item)}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
                      <span>Sold {item.qty}</span>
                      <Badge variant={item.returnable_qty > 0 ? 'success' : 'danger'} className="text-[10px]">
                        Returnable {item.returnable_qty}
                      </Badge>
                      <span className="tabular-nums">{formatBDT(item.unit_price)}</span>
                    </span>
                  </span>
                </button>

                {selected ? (
                  <div className="mt-3 space-y-2 border-t border-border pt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-text-muted">Qty</span>
                      <div className="flex items-center rounded-lg border border-border">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Decrease qty"
                          onClick={() =>
                            onUpdate(item.id, { qty: Math.max(0.001, selected.qty - 1) })
                          }
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <span className="min-w-10 text-center text-sm tabular-nums">
                          {selected.qty}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Increase qty"
                          disabled={selected.qty >= selected.maxQty}
                          onClick={() =>
                            onUpdate(item.id, {
                              qty: Math.min(selected.maxQty, selected.qty + 1),
                            })
                          }
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <span className="ml-auto text-sm font-semibold tabular-nums">
                        {formatBDT(selected.qty * selected.unitPrice)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {EXCHANGE_CONDITIONS.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => onUpdate(item.id, { condition: c.value })}
                          className={cn(
                            'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                            selected.condition === c.value
                              ? 'border-primary bg-primary text-white'
                              : 'border-border bg-white text-text-primary hover:bg-slate-50',
                          )}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button
          className="rounded-xl"
          disabled={returnLines.length === 0}
          onClick={onContinue}
        >
          Continue to replacements
        </Button>
      </div>
    </section>
  )
}
