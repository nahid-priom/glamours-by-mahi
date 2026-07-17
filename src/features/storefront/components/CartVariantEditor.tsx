import { useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { storefrontService } from '../storefront.service'
import { useCart } from '../cart.context'
import { useStorefrontUI } from '../storefront-ui.context'
import { validateCartItemVariant } from '../utils/product-variants'
import type { CartItem } from '../storefront.types'

function useOpenVariantEditor(item: CartItem) {
  const { openVariantSelector } = useStorefrontUI()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const open = async () => {
    if (loading) return
    setLoading(true)
    try {
      const product = await storefrontService.getProductById(item.productId)
      if (!product) {
        toast('This product option is no longer available.', 'error')
        return
      }
      openVariantSelector({ product, mode: 'change', cartItem: item })
    } catch {
      toast('Could not load the product options. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return { open, loading }
}

/** "Size: M • Color: Pink  [Change]" line under a cart item's name. */
export function CartItemVariantMeta({ item, className }: { item: CartItem; className?: string }) {
  const { open, loading } = useOpenVariantEditor(item)

  if (!item.variantLabel && validateCartItemVariant(item) === 'valid') return null
  if (!item.variantLabel) return null

  return (
    <p className={cn('flex items-center gap-2 text-xs text-[#6B7280]', className)}>
      <span className="truncate">{item.variantLabel}</span>
      <button
        type="button"
        onClick={open}
        disabled={loading}
        className="shrink-0 font-semibold text-[#FF3F7F] underline-offset-2 hover:underline disabled:opacity-50"
      >
        {loading ? 'Loading…' : 'Change'}
      </button>
    </p>
  )
}

/**
 * Friendly repair card for legacy cart items saved without a valid variant.
 * The customer fixes them in place instead of removing and re-adding.
 */
export function CartItemRepairCard({ item }: { item: CartItem }) {
  const { removeItem } = useCart()
  const { open, loading } = useOpenVariantEditor(item)

  return (
    <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5">
      <p className="flex items-start gap-1.5 text-xs text-amber-800">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Please choose the options for this product before checkout.
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={open}
          disabled={loading}
          className="flex items-center gap-1 rounded-full bg-[#FF3F7F] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#d91e5b] disabled:opacity-60"
        >
          {loading && <Loader2 className="h-3 w-3 animate-spin" />}
          Choose Options
        </button>
        <button
          type="button"
          onClick={() => removeItem(item.productId, item.variantId)}
          className="rounded-full border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
        >
          Remove
        </button>
      </div>
    </div>
  )
}