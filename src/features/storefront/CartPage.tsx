import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatBDT } from '@/lib/format'
import { FREE_DELIVERY_THRESHOLD } from '@/lib/constants'
import { useCart } from './cart.context'
import { ProductImage } from '@/components/common/ProductImage'
import { CartItemRepairCard, CartItemVariantMeta } from './components/CartVariantEditor'
import { hasUnresolvedCartItems, validateCartItemVariant } from './utils/product-variants'

export function CartPage() {
  const { items, subtotal, deliveryCharge, total, updateQuantity, removeItem } = useCart()
  const firstInvalidRef = useRef<HTMLLIElement | null>(null)
  const blocked = hasUnresolvedCartItems(items)

  const scrollToFirstInvalid = () => {
    firstInvalidRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  if (items.length === 0) {
    return (
      <div className="sf-container max-w-[1440px] py-16 text-center">
        <h1 className="font-serif text-3xl text-[var(--sf-ink)]">Your Cart</h1>
        <p className="mt-3 text-[var(--sf-muted)]">Your bag is empty</p>
        <Link to="/shop">
          <Button className="mt-6 rounded-full bg-[var(--sf-primary)] hover:bg-[var(--sf-primary-hover)]">
            Continue Shopping
          </Button>
        </Link>
      </div>
    )
  }

  let invalidSeen = false

  return (
    <div className="sf-container max-w-[1440px] py-8">
      <h1 className="font-serif text-3xl text-[var(--sf-ink)]">Your Cart</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <ul className="space-y-4 lg:col-span-2">
          {items.map((item) => {
            const invalid = validateCartItemVariant(item) !== 'valid'
            const isFirstInvalid = invalid && !invalidSeen
            if (isFirstInvalid) invalidSeen = true
            return (
              <li
                key={`${item.productId}:${item.variantId ?? 'base'}`}
                ref={isFirstInvalid ? firstInvalidRef : undefined}
                className="flex gap-4 rounded-2xl border border-[var(--sf-border)] bg-white p-4"
              >
                <Link
                  to={`/product/${item.slug}`}
                  className="h-28 w-20 shrink-0 overflow-hidden rounded-xl"
                >
                  <ProductImage
                    product={item}
                    alt={item.alt}
                    aspectRatio="portrait"
                    className="h-28 w-20"
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/product/${item.slug}`}
                    className="font-medium text-[var(--sf-ink)] hover:text-[var(--sf-primary)]"
                  >
                    {item.name || 'Product'}
                  </Link>
                  <CartItemVariantMeta item={item} className="mt-0.5" />
                  <p className="mt-1 text-sm text-[var(--sf-muted)]">{formatBDT(item.price)} each</p>
                  {invalid ? (
                    <CartItemRepairCard item={item} />
                  ) : (
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.productId, item.quantity - 1, item.variantId)}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--sf-border)]"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.productId, item.quantity + 1, item.variantId)}
                        disabled={item.quantity >= item.maxStock}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--sf-border)] disabled:opacity-40"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(item.productId, item.variantId)}
                        className="ml-auto text-[var(--sf-muted)] hover:text-[var(--sf-primary)]"
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
                <p className="shrink-0 text-sm font-semibold text-[var(--sf-ink)]">
                  {formatBDT(item.price * item.quantity)}
                </p>
              </li>
            )
          })}
        </ul>

        <div className="rounded-2xl border border-[var(--sf-border)] bg-white p-5 lg:sticky lg:top-28 lg:self-start">
          <h2 className="font-serif text-lg text-[var(--sf-ink)]">Summary</h2>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--sf-muted)]">Subtotal</span>
              <span>{formatBDT(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--sf-muted)]">Delivery</span>
              <span>{deliveryCharge === 0 ? 'Free' : formatBDT(deliveryCharge)}</span>
            </div>
            <div className="flex justify-between border-t border-[var(--sf-border)] pt-2 font-semibold">
              <span>COD Total</span>
              <span className="text-[var(--sf-primary)]">{formatBDT(total)}</span>
            </div>
          </div>
          {subtotal < FREE_DELIVERY_THRESHOLD ? (
            <p className="mt-3 rounded-lg bg-[var(--sf-primary-soft)] px-3 py-2 text-xs text-[var(--sf-primary-hover)]">
              Add {formatBDT(FREE_DELIVERY_THRESHOLD - subtotal)} more for free delivery
            </p>
          ) : null}
          {blocked ? (
            <>
              <Button
                className="mt-5 w-full rounded-full bg-[var(--sf-primary)] hover:bg-[var(--sf-primary-hover)]"
                size="lg"
                onClick={scrollToFirstInvalid}
              >
                Proceed to Checkout
              </Button>
              <p className="mt-2 text-center text-xs text-amber-700">
                Please update this item before checkout.
              </p>
            </>
          ) : (
            <Link to="/checkout">
              <Button
                className="mt-5 w-full rounded-full bg-[var(--sf-primary)] hover:bg-[var(--sf-primary-hover)]"
                size="lg"
              >
                Proceed to Checkout
              </Button>
            </Link>
          )}
          <Link
            to="/shop"
            className="mt-3 block text-center text-sm text-[var(--sf-muted)] hover:text-[var(--sf-primary)]"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  )
}
