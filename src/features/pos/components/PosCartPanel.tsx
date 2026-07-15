import { Minus, Plus, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { AppImage } from '@/components/common/AppImage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatBDT } from '@/lib/format'
import { cn } from '@/lib/utils'
import { calcLineTotal } from '../cart-utils'
import type { CartLine, CartTotals } from '../types'

export type PosCartPanelProps = {
  lines: CartLine[]
  totals: CartTotals
  showDiscount?: boolean
  onAdjustQty: (variantId: string, delta: number) => void
  onSetLineDiscount?: (variantId: string, discount: number) => void
  onRemove: (variantId: string) => void
  children?: ReactNode
  className?: string
}

export function PosCartPanel({
  lines,
  totals,
  showDiscount = false,
  onAdjustQty,
  onSetLineDiscount,
  onRemove,
  children,
  className,
}: PosCartPanelProps) {
  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {lines.length === 0 ? (
          <p className="py-10 text-center text-sm text-text-muted">Cart is empty</p>
        ) : (
          lines.map((line) => (
            <div
              key={line.variantId}
              className="flex gap-2 rounded-xl border border-border bg-white p-2"
            >
              <AppImage
                src={line.thumbnailUrl}
                alt={line.productName}
                className="h-14 w-14 shrink-0 overflow-hidden rounded-lg"
                imgClassName="h-full w-full object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{line.productName}</p>
                    <p className="truncate text-xs text-text-muted">{line.variantLabel}</p>
                    <p className="text-xs text-text-muted">{formatBDT(line.unitPrice)}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-danger"
                    aria-label={`Remove ${line.productName}`}
                    onClick={() => onRemove(line.variantId)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <div className="flex items-center rounded-lg border border-border">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="Decrease quantity"
                      onClick={() => onAdjustQty(line.variantId, -1)}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <span className="min-w-8 text-center text-sm tabular-nums">{line.qty}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="Increase quantity"
                      disabled={line.qty >= line.availableStock}
                      onClick={() => onAdjustQty(line.variantId, 1)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {showDiscount && onSetLineDiscount ? (
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.lineDiscount || ''}
                      placeholder="Disc"
                      aria-label="Line discount"
                      className="h-8 w-20"
                      onChange={(e) =>
                        onSetLineDiscount(line.variantId, Number(e.target.value) || 0)
                      }
                    />
                  ) : null}

                  <span className="ml-auto text-sm font-semibold tabular-nums">
                    {formatBDT(calcLineTotal(line))}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-3 space-y-1.5 border-t border-border pt-3 text-sm">
        <Row label="Subtotal" value={formatBDT(totals.subtotal)} />
        {totals.discount > 0 ? <Row label="Discount" value={`−${formatBDT(totals.discount)}`} /> : null}
        {totals.tax > 0 ? <Row label="Tax" value={formatBDT(totals.tax)} /> : null}
        {totals.shipping > 0 ? <Row label="Shipping" value={formatBDT(totals.shipping)} /> : null}
        <Row label="Total" value={formatBDT(totals.grandTotal)} strong />
        <Row label="Paid" value={formatBDT(totals.paid)} />
        <Row label="Due" value={formatBDT(totals.due)} />
        {totals.change > 0 ? <Row label="Change" value={formatBDT(totals.change)} /> : null}
      </div>

      {children ? <div className="mt-3 space-y-2">{children}</div> : null}
    </div>
  )
}

function Row({
  label,
  value,
  strong,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className={cn('flex justify-between gap-2', strong && 'text-base font-semibold')}>
      <span className="text-text-muted">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
