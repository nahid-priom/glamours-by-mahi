import { memo, useRef, useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ProductImage } from '@/components/common/ProductImage'
import { formatBDT } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { PosVariant } from '../types'

const LOW_STOCK = 5
/** Fixed card height so catalogue grid stays aligned regardless of title length. */
export const POS_PRODUCT_CARD_HEIGHT_CLASS = 'h-[292px]'

export type PosProductCardProps = {
  variant: PosVariant
  onAdd: (variant: PosVariant, trigger?: HTMLElement | null) => 'added' | 'stock'
  onPreview: (variant: PosVariant, trigger: HTMLElement | null) => void
  className?: string
}

function PosProductCardComponent({ variant, onAdd, onPreview, className }: PosProductCardProps) {
  const outOfStock = variant.availableStock <= 0
  const lowStock = !outOfStock && variant.availableStock <= LOW_STOCK
  const imageButtonRef = useRef<HTMLButtonElement>(null)
  const [processing, setProcessing] = useState(false)
  const [justAdded, setJustAdded] = useState(false)
  const feedbackTimer = useRef<number | null>(null)

  const handleAdd = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    if (outOfStock || processing) return
    setProcessing(true)
    const outcome = onAdd(variant, event.currentTarget)
    if (outcome === 'added') {
      setJustAdded(true)
      if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current)
      feedbackTimer.current = window.setTimeout(() => setJustAdded(false), 1000)
    }
    setProcessing(false)
  }

  return (
    <article
      className={cn(
        'flex w-full flex-col overflow-hidden rounded-xl border border-border bg-white',
        POS_PRODUCT_CARD_HEIGHT_CLASS,
        outOfStock && 'opacity-70',
        className,
      )}
    >
      <button
        ref={imageButtonRef}
        type="button"
        onClick={() => onPreview(variant, imageButtonRef.current)}
        className="group relative block h-32 w-full shrink-0 cursor-pointer overflow-hidden bg-slate-50 focus:outline-none"
        aria-label={`Preview ${variant.productName}`}
      >
        <ProductImage
          product={{
            id: variant.productId,
            name: variant.productName,
            imageUrl: variant.thumbnailUrl,
          }}
          alt={variant.productName}
          imgClassName="transition-transform duration-200 group-hover:scale-[1.03] group-focus-visible:scale-[1.03]"
        />
        <span className="pointer-events-none absolute inset-0 ring-inset ring-primary/0 transition-[box-shadow] group-hover:ring-2 group-hover:ring-primary/30 group-focus-visible:ring-2 group-focus-visible:ring-primary/40" />
        {outOfStock ? (
          <Badge variant="danger" className="pointer-events-none absolute left-1.5 top-1.5 text-[10px]">
            Out of stock
          </Badge>
        ) : (
          <Badge
            variant={lowStock ? 'warning' : 'success'}
            className="pointer-events-none absolute left-1.5 top-1.5 text-[10px]"
          >
            Stock: {variant.availableStock}
          </Badge>
        )}
      </button>

      <div className="flex min-h-0 flex-1 flex-col gap-0.5 px-2.5 py-2">
        <h3
          className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-slate-900"
          title={variant.productName}
        >
          {variant.productName}
        </h3>
        <p
          className="line-clamp-1 min-h-[1rem] text-xs text-slate-500"
          title={variant.variantLabel || undefined}
        >
          {variant.variantLabel || '\u00A0'}
        </p>
        <p
          className="truncate font-mono text-[10px] tracking-tight text-slate-400"
          title={variant.sku ?? variant.barcode ?? undefined}
        >
          SKU: {variant.sku || variant.barcode || '—'}
        </p>
        <p className="mt-auto text-base font-bold tabular-nums text-[#E11D48]">
          {formatBDT(variant.unitPrice)}
        </p>
      </div>

      <div className="shrink-0 px-2.5 pb-2.5">
        <Button
          type="button"
          size="sm"
          variant={justAdded ? 'success' : 'outline'}
          className={cn(
            'h-9 w-full',
            !justAdded && !outOfStock && 'border-[#E11D48]/40 text-[#E11D48] hover:bg-[#E11D48]/5',
          )}
          disabled={outOfStock || processing}
          onClick={handleAdd}
        >
          {justAdded ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Added
            </>
          ) : (
            <>
              <Plus className="h-3.5 w-3.5" />
              {outOfStock ? 'Out of stock' : 'Add'}
            </>
          )}
        </Button>
      </div>
    </article>
  )
}

export const PosProductCard = memo(PosProductCardComponent)
