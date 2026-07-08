import { Link } from 'react-router-dom'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatBDT } from '@/lib/format'
import { FREE_DELIVERY_THRESHOLD } from '@/lib/constants'
import { useCart } from './cart.context'
import { LazyImage } from './components/LazyImage'

export function CartPage() {
  const { items, subtotal, deliveryCharge, total, updateQuantity, removeItem } = useCart()

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6">
        <h1 className="font-serif text-3xl text-stone-900">Your Cart</h1>
        <p className="mt-3 text-stone-500">Your bag is empty</p>
        <Link to="/shop">
          <Button className="mt-6 rounded-full">Continue Shopping</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="font-serif text-3xl text-stone-900">Your Cart</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <ul className="space-y-4 lg:col-span-2">
          {items.map((item) => (
            <li key={item.productId} className="flex gap-4 rounded-xl border border-stone-200 bg-white p-4">
              <Link to={`/product/${item.slug}`} className="h-28 w-20 shrink-0 overflow-hidden rounded-lg">
                <LazyImage src={item.image} alt={item.alt} aspectRatio="portrait" className="h-28 w-20" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link to={`/product/${item.slug}`} className="font-medium text-stone-900 hover:text-primary">
                  {item.name}
                </Link>
                <p className="mt-1 text-sm text-stone-500">{formatBDT(item.price)} each</p>
                <div className="mt-3 flex items-center gap-2">
                  <button type="button" onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="flex h-8 w-8 items-center justify-center rounded border border-stone-200">
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-8 text-center text-sm">{item.quantity}</span>
                  <button type="button" onClick={() => updateQuantity(item.productId, item.quantity + 1)} disabled={item.quantity >= item.maxStock} className="flex h-8 w-8 items-center justify-center rounded border border-stone-200">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => removeItem(item.productId)} className="ml-auto text-stone-400 hover:text-primary">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <p className="shrink-0 text-sm font-semibold">{formatBDT(item.price * item.quantity)}</p>
            </li>
          ))}
        </ul>

        <div className="rounded-xl border border-stone-200 bg-white p-5 lg:sticky lg:top-20 lg:self-start">
          <h2 className="font-serif text-lg">Summary</h2>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-stone-500">Subtotal</span><span>{formatBDT(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-stone-500">Delivery</span><span>{deliveryCharge === 0 ? 'Free' : formatBDT(deliveryCharge)}</span></div>
            <div className="flex justify-between border-t border-stone-100 pt-2 font-semibold">
              <span>COD Total</span><span className="text-primary">{formatBDT(total)}</span>
            </div>
          </div>
          {subtotal < FREE_DELIVERY_THRESHOLD && (
            <p className="mt-3 text-xs text-blue-700">Add {formatBDT(FREE_DELIVERY_THRESHOLD - subtotal)} more for free delivery</p>
          )}
          <Link to="/checkout">
            <Button className="mt-5 w-full rounded-full" size="lg">Proceed to Checkout</Button>
          </Link>
          <Link to="/shop" className="mt-3 block text-center text-sm text-stone-500 hover:text-primary">
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  )
}
