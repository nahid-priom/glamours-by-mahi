import { Package } from 'lucide-react'
import { AppImage } from '@/components/common/AppImage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatBDT } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { PosVariant } from '../types'

const LOW_STOCK = 5

export type PosProductCardProps = {
  variant: PosVariant
  onPreviewImage: (url: string) => void
  onAdd: (variant: PosVariant) => void
  className?: string
}

export function PosProductCard({ variant, onPreviewImage, onAdd, className }: PosProductCardProps) {
  const outOfStock = variant.availableStock <= 0
  const lowStock = !outOfStock && variant.availableStock <= LOW_STOCK
  const thumb = variant.thumbnailUrl ?? undefined

  return (
    <article
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border border-border bg-white',
        className,
      )}
    >
      <button
        type="button"
        className="relative block aspect-square w-full overflow-hidden bg-slate-50 disabled:cursor-default"
        disabled={!thumb}
        onClick={() => {
          if (thumb) onPreviewImage(thumb)
        }}
        aria-label={`Preview ${variant.productName}`}
      >
        <AppImage
          src={thumb}
          alt={variant.productName}
          aspectRatio="square"
          className="h-full w-full"
          imgClassName="h-full w-full object-cover"
        />
        {outOfStock ? (
          <Badge variant="danger" className="absolute left-2 top-2">
            Out of stock
          </Badge>
        ) : lowStock ? (
          <Badge variant="warning" className="absolute left-2 top-2">
            Low · {variant.availableStock}
          </Badge>
        ) : (
          <Badge variant="success" className="absolute left-2 top-2">
            {variant.availableStock} in stock
          </Badge>
        )}
      </button>

      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-text-primary">
          {variant.productName}
        </h3>
        <p className="truncate text-xs text-text-muted">{variant.variantLabel}</p>
        <p className="truncate text-[11px] text-text-muted">
          {variant.sku}
          {variant.barcode ? ` · ${variant.barcode}` : ''}
        </p>
        <p className="mt-auto pt-1 text-sm font-semibold">{formatBDT(variant.unitPrice)}</p>
        <Button
          type="button"
          size="sm"
          className="mt-1 w-full"
          disabled={outOfStock}
          onClick={() => onAdd(variant)}
        >
          <Package className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>
    </article>
  )
}
