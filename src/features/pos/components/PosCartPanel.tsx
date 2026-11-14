import { memo } from 'react'
import { Minus, Plus, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { ProductImage } from '@/components/common/ProductImage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatBDT } from '@/lib/format'
import { cn } from '@/lib/utils'
import { calcLineTotal, formatPosVariantAttrs } from '../cart-utils'
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

function CartRow({
  line,
  showDiscount,
  onAdjustQty,
  onSetLineDiscount,
  onRemove,
}: {
  line: CartLine
  showDiscount: boolean
  onAdjustQty: (variantId: string, delta: number) => void
  onSetLineDiscount?: (variantId: string, discount: number) => void
  onRemove: (variantId: string) => void
}) {
  const variantAttrs = formatPosVariantAttrs(line.productName, line.variantLabel)

  return (
    <div className="flex gap-2 rounded-xl border border-border bg-white p-2">
      <ProductImage
        product={{
          id: line.productId,
          name: line.productName,
          imageUrl: line.thumbnailUrl,
        }}
        alt={line.productName}
        className="h-12 w-12 shrink-0 overflow-hidden rounded-lg"
        imgClassName="h-full w-full object-cover object-center"
        loading="lazy"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium" title={line.productName}>
              {line.productName}
            </p>
            {variantAttrs ? (
              <p className="truncate text-xs text-text-muted" title={variantAttrs}>
                {variantAttrs}
              </p>
            ) : null}
            {line.barcode ? (
              <p className="truncate font-mono text-[10px] text-text-muted" title={line.barcode}>
                {line.barcode}
              </p>
            ) : null}
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
              onChange={(e) => onSetLineDiscount(line.variantId, Number(e.target.value) || 0)}
            />
          ) : null}

          <span className="ml-auto text-sm font-semibold tabular-nums">
            {formatBDT(calcLineTotal(line))}
          </span>
        </div>
      </div>
    </div>
  )
}

const MemoCartRow = memo(CartRow)

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
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-0.5">
        {lines.length === 0 ? (
          <div className="flex h-full min-h-[120px] items-center justify-center">
            <p className="text-center text-sm text-text-muted">
              Scan a barcode to add items
            </p>
          </div>
        ) : (
          lines.map((line) => (
            <MemoCartRow
              key={line.variantId}
              line={line}
              showDiscount={showDiscount}
              onAdjustQty={onAdjustQty}
              onSetLineDiscount={onSetLineDiscount}
              onRemove={onRemove}
            />
          ))
        )}
      </div>

      <div className="shrink-0 space-y-0.5 border-t border-border bg-white pt-2 text-xs leading-tight">
        {totals.discount > 0 || totals.tax > 0 || totals.shipping > 0 ? (
          <Row label="Subtotal" value={formatBDT(totals.subtotal)} />
        ) : null}
        {totals.discount > 0 ? (
          <Row label="Discount" value={`−${formatBDT(totals.discount)}`} />
        ) : null}
        {totals.tax > 0 ? <Row label="Tax" value={formatBDT(totals.tax)} /> : null}
        {totals.shipping > 0 ? (
          <Row label="Shipping" value={formatBDT(totals.shipping)} />
        ) : null}
        <Row label="Total" value={formatBDT(totals.grandTotal)} strong />
        {totals.paid > 0 ? <Row label="Paid" value={formatBDT(totals.paid)} /> : null}
        {totals.due > 0 ? <Row label="Due" value={formatBDT(totals.due)} /> : null}
        {totals.change > 0 ? <Row label="Change" value={formatBDT(totals.change)} /> : null}
      </div>

      {children ? (
        <div className="mt-2 shrink-0 space-y-1.5 border-t border-border pt-2">{children}</div>
      ) : null}
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
    <div className={cn('flex justify-between gap-2', strong && 'text-sm font-semibold')}>
      <span className="text-text-muted">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
