import { formatBDT, formatDateTime } from '@/lib/format'
import { StatusBadge } from '@/components/shared/StatusBadge'
import type { OrderTrackingInfo } from '../storefront.types'
import { Check, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OrderTrackingCardProps {
  tracking: OrderTrackingInfo
}

export function OrderTrackingCard({ tracking }: OrderTrackingCardProps) {
  const primary = tracking.orders[0]

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-stone-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-stone-500">Order ID</p>
            <p className="font-mono text-lg font-semibold text-stone-900">{primary.order_id}</p>
          </div>
          <StatusBadge status={primary.status} />
        </div>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-stone-500">Customer</p>
            <p className="font-medium">{primary.customer_name}</p>
            <p className="text-stone-600">{primary.customer_phone}</p>
          </div>
          <div>
            <p className="text-stone-500">COD Amount</p>
            <p className="font-semibold text-primary">{formatBDT(primary.cod_amount)}</p>
          </div>
          {primary.courier_name && (
            <div>
              <p className="text-stone-500">Courier</p>
              <p className="font-medium">{primary.courier_name}</p>
            </div>
          )}
          {primary.tracking_id && (
            <div>
              <p className="text-stone-500">Tracking ID</p>
              <p className="font-mono text-sm">{primary.tracking_id}</p>
            </div>
          )}
        </div>
        <div className="mt-4 border-t border-stone-100 pt-4">
          <p className="text-sm font-medium text-stone-900">{primary.product_name}</p>
          <p className="text-sm text-stone-500">Qty: {primary.quantity} · {primary.delivery_address}</p>
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5">
        <h3 className="font-serif text-lg">Delivery Timeline</h3>
        <ol className="mt-4 space-y-4">
          {tracking.timeline.map((step, idx) => (
            <li key={`${step.status}-${idx}`} className="flex gap-3">
              <div className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                step.done ? 'bg-success text-white' : 'border-2 border-stone-200 text-stone-300',
              )}>
                {step.done ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3 w-3" />}
              </div>
              <div>
                <p className={cn('text-sm font-medium', step.done ? 'text-stone-900' : 'text-stone-400')}>
                  {step.status}
                </p>
                {step.date && (
                  <p className="text-xs text-stone-500">{formatDateTime(step.date)}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {tracking.orders.length > 1 && (
        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <h3 className="font-serif text-lg">Related Orders</h3>
          <ul className="mt-3 space-y-2">
            {tracking.orders.slice(1).map((o) => (
              <li key={o.id} className="flex justify-between text-sm">
                <span className="font-mono">{o.order_id}</span>
                <span>{o.product_name}</span>
                <StatusBadge status={o.status} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
