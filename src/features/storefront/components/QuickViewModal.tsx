import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Minus, Plus, ShoppingBag, X } from 'lucide-react'
import { formatBDT } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { useCart } from '../cart.context'
import { useStorefrontUI } from '../storefront-ui.context'
import { ProductImage } from '@/components/common/ProductImage'
import { useVariantSelection } from '../hooks/useVariantSelection'
import { VariantAttributePicker } from './VariantAttributePicker'
import {
  getAutoSelectableVariant,
  hasUnresolvedCartItems,
  validateCartItemVariant,
} from '../utils/product-variants'
import { CartItemRepairCard, CartItemVariantMeta } from './CartVariantEditor'
import type { StorefrontProduct } from '../storefront.types'

function QuickViewBody({
  product: p,
  onClose,
}: {
  product: StorefrontProduct
  onClose: () => void
}) {
  const { addItem } = useCart()
  const { toast } = useToast()
  const navigate = useNavigate()
  const selection = useVariantSelection(p)
  const { attributes, selectedVariant, missingAttributes } = selection

  const hasAttributes = attributes.length > 0
  const resolved = hasAttributes ? selectedVariant : getAutoSelectableVariant(p)
  const price = resolved?.sellingPrice ?? p.displayPrice
  const stock = hasAttributes ? (resolved?.stock ?? 0) : p.stock
  const canAdd = hasAttributes
    ? resolved !== null && stock > 0
    : p.stock > 0

  const addResolved = (): boolean => {
    if (!canAdd) {
      if (missingAttributes.length > 0) {
        toast(`Please select ${missingAttributes.join(' and ')}.`, 'error')
      }
      return false
    }
    addItem(
      p,
      1,
      resolved
        ? {
            variantId: resolved.id,
            price: resolved.sellingPrice,
            sku: resolved.sku,
            maxStock: resolved.stock,
          }
        : undefined,
    )
    return true
  }

  return (
    <div className="grid sm:grid-cols-2">
      <div className="aspect-square sm:aspect-auto">
        <ProductImage product={p} alt={p.alt} aspectRatio="square" className="h-full min-h-[280px]" loading="eager" />
      </div>
      <div className="p-6 sm:p-8">
        <p className="text-[11px] uppercase tracking-widest text-[#6B7280]">{p.category.replace('-', ' ')}</p>
        <h2 className="mt-2 font-serif text-2xl text-[#22171C]">{p.name}</h2>
        <p className="mt-3 text-xl font-semibold">{formatBDT(price)}</p>
        <p className={`mt-2 text-xs font-medium ${stock > 0 ? 'text-success' : 'text-danger'}`}>
          {hasAttributes && !resolved
            ? 'Please select the available options.'
            : stock > 0
              ? `${stock} in stock`
              : 'Out of stock'}
        </p>

        {hasAttributes && (
          <div className="mt-5">
            <VariantAttributePicker selection={selection} compact />
          </div>
        )}

        <p className="mt-4 text-sm leading-relaxed text-[#6B7280] line-clamp-3">{p.description}</p>
        <div className="mt-6 flex flex-col gap-3">
          <Button
            className="w-full rounded-full"
            disabled={!canAdd}
            onClick={() => {
              if (addResolved()) onClose()
            }}
          >
            <ShoppingBag className="mr-2 h-4 w-4" /> Add to Cart
          </Button>
          <Button
            variant="outline"
            className="w-full rounded-full"
            disabled={!canAdd}
            onClick={() => {
              if (addResolved()) {
                onClose()
                navigate('/checkout')
              }
            }}
          >
            Buy Now
          </Button>
          <Link
            to={`/product/${p.slug}`}
            onClick={onClose}
            className="text-center text-sm text-[#6B7280] hover:text-[#22171C]"
          >
            View full details
          </Link>
        </div>
      </div>
    </div>
  )
}

export function QuickViewModal() {
  const { quickViewProduct, closeQuickView } = useStorefrontUI()

  useEffect(() => {
    if (!quickViewProduct) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeQuickView()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [quickViewProduct, closeQuickView])

  if (!quickViewProduct) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6">
      <button type="button" className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={closeQuickView} aria-label="Close" />
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <button type="button" onClick={closeQuickView} className="absolute right-4 top-4 z-10 rounded-full bg-white p-2 shadow-md">
          <X className="h-5 w-5" />
        </button>
        <QuickViewBody key={quickViewProduct.id} product={quickViewProduct} onClose={closeQuickView} />
      </div>
    </div>
  )
}

export function CartDrawer() {
  const { cartOpen, closeCart } = useStorefrontUI()
  const { items, subtotal, deliveryCharge, total, updateQuantity, removeItem } = useCart()
  const blocked = hasUnresolvedCartItems(items)

  if (!cartOpen) return null

  return (
    <div className="fixed inset-0 z-[65]">
      <button type="button" className="absolute inset-0 bg-black/40" onClick={closeCart} aria-label="Close cart" />
      <div className="absolute bottom-0 right-0 top-0 flex w-full max-w-md flex-col bg-white shadow-2xl sm:bottom-auto lg:max-w-md">
        <div className="flex items-center justify-between border-b border-[#22171C]/5 px-5 py-4">
          <h2 className="font-serif text-xl">Shopping Bag ({items.length})</h2>
          <button type="button" onClick={closeCart}><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <ShoppingBag className="h-10 w-10 text-[#6B7280]/30" />
              <p className="mt-3 text-sm text-[#6B7280]">Your bag is empty</p>
            </div>
          ) : (
            <ul className="space-y-4">
              {items.map((item) => (
                <li key={`${item.productId}:${item.variantId ?? 'base'}`} className="flex gap-3">
                  <div className="h-24 w-20 shrink-0 overflow-hidden rounded-xl">
                    <ProductImage product={item} alt={item.alt} aspectRatio="portrait" className="h-24 w-20" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.name || 'Product'}</p>
                    <CartItemVariantMeta item={item} className="mt-0.5" />
                    <p className="text-sm text-[#6B7280]">{formatBDT(item.price)}</p>
                    {validateCartItemVariant(item) !== 'valid' ? (
                      <CartItemRepairCard item={item} />
                    ) : (
                      <div className="mt-2 flex items-center gap-2">
                        <button type="button" onClick={() => updateQuantity(item.productId, item.quantity - 1, item.variantId)} className="flex h-7 w-7 items-center justify-center rounded-full border" aria-label="Decrease quantity">
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center text-sm">{item.quantity}</span>
                        <button type="button" onClick={() => updateQuantity(item.productId, item.quantity + 1, item.variantId)} className="flex h-7 w-7 items-center justify-center rounded-full border" disabled={item.quantity >= item.maxStock} aria-label="Increase quantity">
                          <Plus className="h-3 w-3" />
                        </button>
                        <button type="button" onClick={() => removeItem(item.productId, item.variantId)} className="ml-auto text-xs text-[#6B7280] hover:text-[#FF3F7F]">Remove</button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-[#22171C]/5 px-4 py-4">
            <div className="rounded-xl border border-dashed border-[#22171C]/10 px-3 py-2 text-xs text-[#6B7280]">
              Coupon code — coming soon
            </div>
            <div className="mt-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-[#6B7280]">Subtotal</span><span>{formatBDT(subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-[#6B7280]">Delivery</span><span>{deliveryCharge === 0 ? 'Free' : formatBDT(deliveryCharge)}</span></div>
              <div className="flex justify-between pt-2 text-base font-semibold"><span>Total</span><span className="text-[#FF3F7F]">{formatBDT(total)}</span></div>
            </div>
            {blocked ? (
              <>
                <Button className="mt-4 w-full rounded-full" size="lg" disabled>
                  Checkout
                </Button>
                <p className="mt-2 text-center text-xs text-amber-700">
                  Please update the highlighted items before checkout.
                </p>
              </>
            ) : (
              <Link to="/checkout" onClick={closeCart}>
                <Button className="mt-4 w-full rounded-full" size="lg">Checkout</Button>
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
