import { Minus, Plus, Trash2 } from 'lucide-react'
import { ProductImage } from '@/components/common/ProductImage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatBDT } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ReplacementLine } from '../types'

type Props = {
  lines: ReplacementLine[]
  onAdjustQty: (key: string, delta: number) => void
  onSetQty: (key: string, qty: number) => void
  onSetPrice: (key: string, unitPrice: number) => void
  onRemove: (key: string) => void
  className?: string
}

export function ExchangeReplacementCart({
  lines,
  onAdjustQty,
  onSetQty,
  onSetPrice,
  onRemove,
  className,
}: Props) {
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-0.5">
        {lines.length === 0 ? (
          <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed border-border px-4">
            <p className="text-center text-sm text-text-muted">
              Search the catalogue and add replacements
            </p>
          </div>
        ) : (
          lines.map((line) => (
            <div
              key={line.key}
              className="flex gap-2 rounded-xl border border-border bg-white p-2"
            >
              <ProductImage
                product={{
                  id: line.variantId,
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
                    <p className="truncate text-xs text-text-muted" title={line.variantLabel}>
                      {line.variantLabel}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-danger"
                    aria-label={`Remove ${line.productName}`}
                    onClick={() => onRemove(line.key)}
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
                      onClick={() => onAdjustQty(line.key, -1)}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <Input
                      type="number"
                      min={0.001}
                      step="any"
                      value={line.qty}
                      aria-label="Quantity"
                      className="h-8 w-12 border-0 px-0 text-center text-sm tabular-nums shadow-none focus-visible:ring-0"
                      onChange={(e) => onSetQty(line.key, Number(e.target.value) || 0)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="Increase quantity"
                      onClick={() => onAdjustQty(line.key, 1)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={line.unitPrice}
                    aria-label="Unit price"
                    className="h-8 w-20"
                    onChange={(e) => onSetPrice(line.key, Number(e.target.value) || 0)}
                  />
                  <span className="ml-auto text-sm font-semibold tabular-nums">
                    {formatBDT(line.qty * line.unitPrice)}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
