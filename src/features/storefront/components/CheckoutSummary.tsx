import { formatBDT } from '@/lib/format'
import { FREE_DELIVERY_THRESHOLD } from '@/lib/constants'

interface CheckoutSummaryProps {
  subtotal: number
  deliveryCharge: number
  total: number
  itemCount: number
}

export function CheckoutSummary({ subtotal, deliveryCharge, total, itemCount }: CheckoutSummaryProps) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5">
      <h2 className="font-serif text-lg text-stone-900">Order Summary</h2>
      <p className="mt-1 text-sm text-stone-500">{itemCount} item{itemCount !== 1 ? 's' : ''}</p>
      <div className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-stone-500">Subtotal</span>
          <span>{formatBDT(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-stone-500">Delivery</span>
          <span>{deliveryCharge === 0 ? 'Free' : formatBDT(deliveryCharge)}</span>
        </div>
        <div className="flex justify-between border-t border-stone-100 pt-2 text-base font-semibold">
          <span>COD Total</span>
          <span className="text-primary">{formatBDT(total)}</span>
        </div>
      </div>
      {subtotal > 0 && subtotal < FREE_DELIVERY_THRESHOLD && (
        <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
          Add {formatBDT(FREE_DELIVERY_THRESHOLD - subtotal)} more for free delivery
        </p>
      )}
      <p className="mt-4 text-xs leading-relaxed text-stone-400">
        Pay cash on delivery. Your order will sync instantly with our order management system.
      </p>
    </div>
  )
}
