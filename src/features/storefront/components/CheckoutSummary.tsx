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
    <div className="rounded-2xl border border-[var(--sf-border)] bg-white p-5">
      <h2 className="font-serif text-lg text-[var(--sf-ink)]">Order Summary</h2>
      <p className="mt-1 text-sm text-[var(--sf-muted)]">
        {itemCount} item{itemCount !== 1 ? 's' : ''}
      </p>
      <div className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-[var(--sf-muted)]">Subtotal</span>
          <span>{formatBDT(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--sf-muted)]">Delivery</span>
          <span>{deliveryCharge === 0 ? 'Free' : formatBDT(deliveryCharge)}</span>
        </div>
        <div className="flex justify-between border-t border-[var(--sf-border)] pt-2 text-base font-semibold">
          <span>COD Total</span>
          <span className="text-[var(--sf-primary)]">{formatBDT(total)}</span>
        </div>
      </div>
      {subtotal > 0 && subtotal < FREE_DELIVERY_THRESHOLD ? (
        <p className="mt-3 rounded-lg bg-[var(--sf-primary-soft)] px-3 py-2 text-xs text-[var(--sf-primary-hover)]">
          Add {formatBDT(FREE_DELIVERY_THRESHOLD - subtotal)} more for free delivery
        </p>
      ) : null}
      <p className="mt-4 text-xs leading-relaxed text-[var(--sf-muted)]">
        Pay cash on delivery. Your order syncs with inventory and accounts.
      </p>
    </div>
  )
}
