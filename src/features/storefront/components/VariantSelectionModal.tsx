import { useEffect, useMemo, useState } from 'react'
import { Check, Minus, Plus, ShoppingBag, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProductImage } from '@/components/common/ProductImage'
import { useToast } from '@/components/ui/toast'
import { formatBDT } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useCart } from '../cart.context'
import { useStorefrontUI } from '../storefront-ui.context'
import { useVariantSelection } from '../hooks/useVariantSelection'
import { getDisplayCategory, getDisplayName } from '../utils/product-display'
import { formatVariantLabel, type SelectedOptions } from '../utils/product-variants'
import { VariantAttributePicker } from './VariantAttributePicker'
import type { CartItem, StorefrontProduct } from '../storefront.types'

function initialSelectionFromCartItem(item?: CartItem): SelectedOptions | undefined {
  if (!item?.selectedOptions?.length) return undefined
  const selected: SelectedOptions = {}
  for (const optionValue of item.selectedOptions) {
    if (optionValue.option && optionValue.value) selected[optionValue.option] = optionValue.value
  }
  return selected
}

function ModalBody({
  product,
  mode,
  cartItem,
  onDone,
}: {
  product: StorefrontProduct
  mode: 'add' | 'change'
  cartItem?: CartItem
  onDone: () => void
}) {
  const { addItem, changeItemVariant, items } = useCart()
  const { toast } = useToast()
  const selection = useVariantSelection(product, initialSelectionFromCartItem(cartItem))
  const { selectedVariant, missingAttributes, isComplete } = selection

  const [qty, setQty] = useState(() => Math.max(1, cartItem?.quantity ?? 1))
  const [submitting, setSubmitting] = useState(false)

  const price = selectedVariant?.sellingPrice ?? product.displayPrice
  const stock = selectedVariant?.stock ?? 0
  const combinationOutOfStock = isComplete && selectedVariant !== null && stock <= 0
  const combinationMissing = isComplete && selectedVariant === null
  const canSubmit = isComplete && selectedVariant !== null && stock > 0 && !submitting

  // Existing quantity of the same variant already in the cart (add mode merges).
  const alreadyInCart = useMemo(() => {
    if (!selectedVariant) return 0
    return (
      items.find((i) => i.productId === product.id && i.variantId === selectedVariant.id)
        ?.quantity ?? 0
    )
  }, [items, product.id, selectedVariant])

  useEffect(() => {
    if (stock > 0) setQty((current) => Math.min(current, stock))
  }, [stock])

  const helperMessage = combinationOutOfStock
    ? 'This combination is currently out of stock.'
    : combinationMissing
      ? 'This product option is no longer available. Please pick a different combination.'
      : missingAttributes.length > 0
        ? `Please select ${missingAttributes.join(' and ')}.`
        : null

  const handleConfirm = () => {
    if (!selectedVariant || !canSubmit) return
    setSubmitting(true)
    const options = {
      variantId: selectedVariant.id,
      price: selectedVariant.sellingPrice,
      sku: selectedVariant.sku,
      maxStock: selectedVariant.stock,
      name: getDisplayName(product),
    }
    if (mode === 'change' && cartItem) {
      changeItemVariant(
        { productId: cartItem.productId, variantId: cartItem.variantId },
        product,
        options,
      )
      toast('Cart item updated')
    } else {
      addItem(product, qty, options)
      toast(`${getDisplayName(product)} added to cart`)
    }
    setSubmitting(false)
    onDone()
  }

  const previewImage = selectedVariant?.image || product.image

  return (
    <div className="grid sm:grid-cols-[240px_1fr]">
      <div className="relative hidden bg-pink-50 sm:block">
        <ProductImage
          product={{ id: product.id, name: product.name, imageUrl: previewImage }}
          alt={getDisplayName(product)}
          className="h-full w-full"
          objectFit="cover"
          loading="eager"
        />
      </div>

      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-pink-50 sm:hidden">
            <ProductImage
              product={{ id: product.id, name: product.name, imageUrl: previewImage }}
              alt={getDisplayName(product)}
              className="h-full w-full"
              objectFit="cover"
              loading="eager"
            />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
              {getDisplayCategory(product)}
            </p>
            <h2 className="mt-0.5 line-clamp-2 text-base font-semibold text-[#22171C]">
              {getDisplayName(product)}
            </h2>
            {selectedVariant?.sku ? (
              <p className="mt-0.5 text-[11px] text-[#6B7280]">SKU: {selectedVariant.sku}</p>
            ) : null}
            <p className="mt-1 text-lg font-bold text-[#FF3F7F]">{formatBDT(price)}</p>
          </div>
        </div>

        <div className="mt-5">
          <VariantAttributePicker selection={selection} compact />
        </div>

        <div className="mt-4 min-h-5 text-xs font-medium">
          {helperMessage ? (
            <span className={combinationOutOfStock || combinationMissing ? 'text-danger' : 'text-[#6B7280]'}>
              {helperMessage}
            </span>
          ) : selectedVariant ? (
            <span className="inline-flex items-center gap-1 text-success">
              <Check className="h-3.5 w-3.5" />
              {formatVariantLabel(selectedVariant.optionValues) || 'Ready to add'} — {stock} in stock
              {alreadyInCart > 0 && mode === 'add' ? ` · ${alreadyInCart} already in cart` : ''}
            </span>
          ) : null}
        </div>

        {mode === 'add' && (
          <div className="mt-4 flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[#6B7280]">
              Quantity
            </span>
            <div className="flex items-center rounded-full border border-[#22171C]/10 bg-white">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="px-3 py-2 transition hover:bg-[#FFF9FB]"
                aria-label="Decrease quantity"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-8 text-center text-sm font-semibold">{qty}</span>
              <button
                type="button"
                onClick={() => setQty((q) => Math.min(Math.max(stock, 1), q + 1))}
                disabled={stock > 0 && qty >= stock}
                className="px-3 py-2 transition hover:bg-[#FFF9FB] disabled:opacity-40"
                aria-label="Increase quantity"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        <Button
          className={cn(
            'mt-5 h-11 w-full rounded-full text-sm font-semibold',
            'bg-[#ff3f7f] text-white hover:bg-[#d91e5b]',
          )}
          disabled={!canSubmit}
          onClick={handleConfirm}
        >
          <ShoppingBag className="h-4 w-4" />
          {mode === 'change' ? 'Update Selection' : 'Add to Cart'}
        </Button>
      </div>
    </div>
  )
}

/**
 * Shared premium selection modal. Opened from product cards for
 * variation products and from the cart's "Change" action.
 */
export function VariantSelectionModal() {
  const { variantSelection, closeVariantSelector } = useStorefrontUI()

  useEffect(() => {
    if (!variantSelection) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeVariantSelector()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [variantSelection, closeVariantSelector])

  if (!variantSelection) return null

  const { product, mode, cartItem } = variantSelection

  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        onClick={closeVariantSelector}
        aria-label="Close"
      />
      <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <button
          type="button"
          onClick={closeVariantSelector}
          className="absolute right-3 top-3 z-10 rounded-full bg-white p-2 shadow-md"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <ModalBody
          key={`${product.id}-${cartItem?.variantId ?? 'add'}`}
          product={product}
          mode={mode}
          cartItem={cartItem}
          onDone={closeVariantSelector}
        />
      </div>
    </div>
  )
}
