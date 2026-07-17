import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Minus, Plus, ShoppingBag, X } from 'lucide-react'
import { formatBDT } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { useCart } from '../cart.context'
import { useStorefrontUI } from '../storefront-ui.context'
import { ProductImage } from '@/components/common/ProductImage'

export function QuickViewModal() {
  const { quickViewProduct, closeQuickView } = useStorefrontUI()
  const { addItem } = useCart()
  const navigate = useNavigate()

  useEffect(() => {
    if (!quickViewProduct) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeQuickView()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [quickViewProduct, closeQuickView])

  if (!quickViewProduct) return null

  const p = quickViewProduct

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6">
      <button type="button" className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={closeQuickView} aria-label="Close" />
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <button type="button" onClick={closeQuickView} className="absolute right-4 top-4 z-10 rounded-full bg-white p-2 shadow-md">
          <X className="h-5 w-5" />
        </button>
        <div className="grid sm:grid-cols-2">
          <div className="aspect-[4/5] sm:aspect-auto">
            <ProductImage product={p} alt={p.alt} aspectRatio="portrait" className="h-full min-h-[280px]" loading="eager" />
          </div>
          <div className="p-6 sm:p-8">
            <p className="text-[11px] uppercase tracking-widest text-[#6B7280]">{p.category.replace('-', ' ')}</p>
            <h2 className="mt-2 font-serif text-2xl text-[#22171C]">{p.name}</h2>
            <p className="mt-3 text-xl font-semibold">{formatBDT(p.displayPrice)}</p>
            <p className={`mt-2 text-xs font-medium ${p.stock > 0 ? 'text-success' : 'text-danger'}`}>
              {p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}
            </p>
            {p.catalogVariants?.[0] ? (
              <p className="mt-1 text-xs text-text-muted">Variant: {p.catalogVariants[0].label}</p>
            ) : null}
            <p className="mt-4 text-sm leading-relaxed text-[#6B7280] line-clamp-4">{p.description}</p>
            <div className="mt-6 flex flex-col gap-3">
              <Button
                className="w-full rounded-full"
                disabled={p.stock <= 0}
                onClick={() => {
                  addItem(p, 1)
                  closeQuickView()
                }}
              >
                <ShoppingBag className="mr-2 h-4 w-4" /> Add to Cart
              </Button>
              <Button
                variant="outline"
                className="w-full rounded-full"
                onClick={() => {
                  addItem(p, 1)
                  closeQuickView()
                  navigate('/checkout')
                }}
              >
                Buy Now
              </Button>
              <Link
                to={`/product/${p.slug}`}
                onClick={closeQuickView}
                className="text-center text-sm text-[#6B7280] hover:text-[#22171C]"
              >
                View full details
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function CartDrawer() {
  const { cartOpen, closeCart } = useStorefrontUI()
  const { items, subtotal, deliveryCharge, total, updateQuantity, removeItem } = useCart()

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
                <li key={item.productId} className="flex gap-3">
                  <div className="h-24 w-20 shrink-0 overflow-hidden rounded-xl">
                    <ProductImage product={item} alt={item.alt} aspectRatio="portrait" className="h-24 w-20" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="text-sm text-[#6B7280]">{formatBDT(item.price)}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <button type="button" onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="flex h-7 w-7 items-center justify-center rounded-full border">
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center text-sm">{item.quantity}</span>
                      <button type="button" onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="flex h-7 w-7 items-center justify-center rounded-full border" disabled={item.quantity >= item.maxStock}>
                        <Plus className="h-3 w-3" />
                      </button>
                      <button type="button" onClick={() => removeItem(item.productId)} className="ml-auto text-xs text-[#6B7280] hover:text-[#FF3F7F]">Remove</button>
                    </div>
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
            <Link to="/checkout" onClick={closeCart}>
              <Button className="mt-4 w-full rounded-full" size="lg">Checkout</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
