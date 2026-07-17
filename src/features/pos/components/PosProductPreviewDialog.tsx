import { useEffect, useRef, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Check, Plus, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ProductImage } from '@/components/common/ProductImage'
import { formatBDT } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { PosVariant } from '../types'

export type PosProductPreviewDialogProps = {
  variant: PosVariant | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (variant: PosVariant) => 'added' | 'stock'
  inCartQty: number
  restoreFocusRef?: React.RefObject<HTMLElement | null>
}

export function PosProductPreviewDialog({
  variant,
  open,
  onOpenChange,
  onAdd,
  inCartQty,
  restoreFocusRef,
}: PosProductPreviewDialogProps) {
  const [justAdded, setJustAdded] = useState(false)
  const feedbackTimer = useRef<number | null>(null)

  useEffect(() => {
    if (!open) setJustAdded(false)
  }, [open])

  useEffect(() => {
    return () => {
      if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current)
    }
  }, [])

  if (!variant) return null

  const atStockLimit = variant.availableStock <= 0 || inCartQty >= variant.availableStock

  const handleAdd = () => {
    if (atStockLimit) return
    const outcome = onAdd(variant)
    if (outcome === 'added') {
      setJustAdded(true)
      if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current)
      feedbackTimer.current = window.setTimeout(() => setJustAdded(false), 1000)
    }
  }

  const addLabel = justAdded
    ? 'Added'
    : atStockLimit
      ? variant.availableStock <= 0
        ? 'Out of stock'
        : 'Stock limit reached'
      : 'Add to Cart'

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          onCloseAutoFocus={(event) => {
            if (restoreFocusRef?.current) {
              event.preventDefault()
              restoreFocusRef.current.focus()
            }
          }}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-1.5rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2',
            'max-h-[90dvh] overflow-hidden rounded-2xl border border-border bg-white shadow-xl',
            'duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          )}
        >
          <DialogPrimitive.Close
            className="absolute right-3 top-3 z-10 rounded-lg bg-white/90 p-1.5 text-text-muted shadow-sm transition hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
            aria-label="Close preview"
          >
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>

          <div className="grid max-h-[90dvh] grid-rows-[auto_1fr_auto] sm:grid-cols-2 sm:grid-rows-1">
            <div className="flex items-center justify-center bg-[#F3F0EB] p-3 sm:h-full">
              <div className="flex h-full max-h-[45dvh] w-full items-center justify-center sm:max-h-[80dvh]">
                <ProductImage
                  product={{
                    id: variant.productId,
                    name: variant.productName,
                    imageUrl: variant.thumbnailUrl,
                  }}
                  alt={variant.productName}
                  objectFit="contain"
                  loading="eager"
                  className="max-h-[45dvh] sm:max-h-[80dvh]"
                  imgClassName="max-h-[45dvh] sm:max-h-[65dvh]"
                />
              </div>
            </div>

            <div className="flex min-h-0 flex-col overflow-y-auto p-4 sm:p-6">
              <DialogPrimitive.Title className="pr-8 text-lg font-semibold leading-snug text-text-primary">
                {variant.productName}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-text-muted">
                {variant.variantLabel}
                {variant.sku ? ` · ${variant.sku}` : ''}
              </DialogPrimitive.Description>

              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Price</span>
                  <span className="text-xl font-semibold tabular-nums">
                    {formatBDT(variant.unitPrice)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Available stock</span>
                  <Badge variant={variant.availableStock > 0 ? 'success' : 'danger'}>
                    {variant.availableStock}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">In cart</span>
                  <span className="font-medium tabular-nums">{inCartQty}</span>
                </div>
                {variant.barcode ? (
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Barcode</span>
                    <span className="font-mono text-xs">{variant.barcode}</span>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 hidden sm:block">
                <Button
                  type="button"
                  className="w-full"
                  variant={justAdded ? 'success' : 'default'}
                  disabled={atStockLimit && !justAdded}
                  onClick={handleAdd}
                >
                  {justAdded ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {addLabel}
                </Button>
              </div>
            </div>

            <div className="sticky bottom-0 border-t border-border bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:hidden">
              <Button
                type="button"
                className="w-full"
                variant={justAdded ? 'success' : 'default'}
                disabled={atStockLimit && !justAdded}
                onClick={handleAdd}
              >
                {justAdded ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {addLabel}
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
