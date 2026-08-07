import { useRef, useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProductImage } from '@/components/common/ProductImage'
import { formatBDT } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ExchangeCatalogueVariant } from '../types'

type Props = {
  variant: ExchangeCatalogueVariant
  onAdd: (variant: ExchangeCatalogueVariant) => void
  className?: string
}

export function ExchangeCatalogueCard({ variant, onAdd, className }: Props) {
  const [justAdded, setJustAdded] = useState(false)
  const timer = useRef<number | null>(null)

  function handleAdd() {
    onAdd(variant)
    setJustAdded(true)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setJustAdded(false), 1000)
  }

  return (
    <article
      className={cn(
        'self-start overflow-hidden rounded-xl border border-border bg-white',
        className,
      )}
    >
      <div className="relative h-28 w-full overflow-hidden bg-slate-50 sm:h-32">
        <ProductImage
          product={{
            id: variant.productId,
            name: variant.productName,
            imageUrl: variant.thumbnailUrl,
          }}
          alt={variant.productName}
          imgClassName="h-full w-full object-cover"
        />
      </div>
      <div className="space-y-0.5 px-2.5 py-2">
        <h3
          className="line-clamp-1 text-sm font-medium text-text-primary"
          title={variant.productName}
        >
          {variant.productName}
        </h3>
        <p className="line-clamp-1 text-xs text-text-muted" title={variant.variantLabel}>
          {variant.variantLabel}
        </p>
        <p className="text-sm font-semibold tabular-nums">{formatBDT(variant.unitPrice)}</p>
        <p className="truncate font-mono text-[10px] text-text-muted">
          {variant.barcode || variant.sku}
        </p>
      </div>
      <div className="px-2.5 pb-2.5">
        <Button
          type="button"
          size="sm"
          variant={justAdded ? 'success' : 'default'}
          className="h-9 w-full"
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
              Add
            </>
          )}
        </Button>
      </div>
    </article>
  )
}
