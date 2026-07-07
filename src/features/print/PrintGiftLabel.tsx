import type { PrintOrderData } from './print.types'

export function PrintGiftLabel({ order }: { order: PrintOrderData }) {
  return (
    <div className="print-page gift-label-page">
      <p className="text-xs font-semibold uppercase tracking-wide text-red-500">{order.store_name}</p>
      <p className="mt-4 text-lg font-bold">{order.customer_name}</p>
      <p className="mt-3 text-sm text-slate-600">Thank you for shopping with us</p>
      <p className="mt-4 font-mono text-xs text-slate-400">{order.order_id}</p>
    </div>
  )
}
