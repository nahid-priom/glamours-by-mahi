import { memo, useRef, useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ProductImage } from '@/components/common/ProductImage'
import { formatBDT } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { PosVariant } from '../types'

const LOW_STOCK = 5

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
        'self-start overflow-hidden rounded-xl border border-border bg-white',
        outOfStock && 'opacity-70',
        className,
      )}
    >
      <button
        ref={imageButtonRef}
        type="button"
        onClick={() => onPreview(variant, imageButtonRef.current)}
        className="group relative block h-32 w-full cursor-pointer overflow-hidden bg-slate-50 focus:outline-none sm:h-36"
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
        ) : lowStock ? (
          <Badge variant="warning" className="pointer-events-none absolute left-1.5 top-1.5 text-[10px]">
            Low · {variant.availableStock}
          </Badge>
        ) : (
          <Badge variant="success" className="pointer-events-none absolute left-1.5 top-1.5 text-[10px]">
            {variant.availableStock}
          </Badge>
        )}
      </button>

      <div className="space-y-0.5 px-2.5 py-2">
        <h3
          className="line-clamp-1 text-sm font-medium leading-snug text-text-primary"
          title={variant.productName}
        >
          {variant.productName}
        </h3>
        <p className="line-clamp-1 text-xs text-text-muted" title={variant.variantLabel}>
          {variant.variantLabel}
        </p>
        <p className="text-sm font-semibold tabular-nums">
          {formatBDT(variant.unitPrice)}
        </p>
        <p
          className="truncate font-mono text-[10px] tracking-tight text-text-muted"
          title={variant.barcode ?? undefined}
        >
          {variant.barcode || 'No barcode'}
        </p>
      </div>

      <div className="px-2.5 pb-2.5">
        <Button
          type="button"
          size="sm"
          variant={justAdded ? 'success' : 'default'}
          className="h-9 w-full"
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
