import type { PrintOrderData } from './print.types'
import { COMPANY_NAME } from '@/lib/constants'
import { formatBDT, formatDateShort } from '@/lib/format'

export function PrintInvoiceA4({ order }: { order: PrintOrderData }) {
  const unitPrice = order.unit_price ?? (order.quantity > 0 ? order.cod_amount / order.quantity : order.cod_amount)

  return (
    <div className="print-page invoice-page">
      <div className="invoice-header">
        <div className="flex items-start gap-3">
          <div className="invoice-logo">R</div>
          <div>
            <h1 className="text-xl font-bold">{order.store_name}</h1>
            <p className="text-xs text-slate-500">Cash on Delivery Invoice</p>
          </div>
        </div>
        <div className="text-right text-sm">
          <p className="font-bold text-red-500">INVOICE</p>
          <p className="font-mono font-semibold">{order.order_id}</p>
          <p className="text-xs text-slate-500">{formatDateShort(order.created_at)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Bill To</p>
          <p className="font-semibold">{order.customer_name}</p>
          <p>{order.customer_phone}</p>
          <p className="label-address mt-1 text-slate-600">{order.delivery_address}</p>
        </div>
        <div className="text-right">
          {order.courier_name && (
            <>
              <p className="text-xs font-semibold uppercase text-slate-500">Courier</p>
              <p className="font-medium">{order.courier_name}</p>
            </>
          )}
          {order.tracking_id && (
            <p className="mt-1 font-mono text-xs">{order.tracking_id}</p>
          )}
        </div>
      </div>

      <table className="invoice-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>SKU</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{order.product_name}</td>
            <td>{order.sku ?? '—'}</td>
            <td>{order.quantity}</td>
            <td>{formatBDT(unitPrice)}</td>
            <td className="font-semibold">{formatBDT(order.cod_amount)}</td>
          </tr>
        </tbody>
      </table>

      <div className="flex justify-end">
        <div className="w-56 text-sm">
          <div className="flex justify-between border-t border-slate-200 py-2 font-bold">
            <span>COD Amount</span>
            <span className="text-red-500">{formatBDT(order.cod_amount)}</span>
          </div>
        </div>
      </div>

      {(order.customer_note || order.order_note) && (
        <div className="mt-4 rounded border border-slate-200 p-3 text-xs">
          {order.customer_note && <p><strong>Customer Note:</strong> {order.customer_note}</p>}
          {order.order_note && <p className="mt-1"><strong>Order Note:</strong> {order.order_note}</p>}
        </div>
      )}

      <div className="mt-8 grid grid-cols-2 gap-8 text-xs text-slate-500">
        <div>
          <p className="mb-8 font-semibold text-slate-700">Customer Signature</p>
          <div className="border-b border-slate-300" />
        </div>
        <div>
          <p className="mb-2 font-semibold text-slate-700">Terms</p>
          <p>Payment due on delivery. Please check product before accepting. Returns subject to store policy.</p>
        </div>
      </div>

      <p className="mt-8 text-center text-xs text-slate-400">
        Powered by {COMPANY_NAME}
      </p>
    </div>
  )
}
