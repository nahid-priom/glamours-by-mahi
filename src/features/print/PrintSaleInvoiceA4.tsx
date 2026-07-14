import type { PrintSaleData } from './print.types'
import { formatBDT, formatDateShort } from '@/lib/format'

export function PrintSaleInvoiceA4({ sale }: { sale: PrintSaleData }) {
  return (
    <div className="print-page invoice-page">
      <div className="invoice-header">
        <div>
          <h1 className="text-xl font-bold">{sale.storeName}</h1>
          <p className="text-xs text-slate-500">Tax Invoice / Sales Receipt</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-bold text-red-500">INVOICE</p>
          <p className="font-mono font-semibold">{sale.saleNo}</p>
          <p className="text-xs text-slate-500">{formatDateShort(sale.createdAt)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Bill To</p>
          <p className="font-semibold">{sale.customerName}</p>
          <p>{sale.customerPhone}</p>
          <p className="mt-1 text-slate-600">{sale.customerAddress}</p>
        </div>
        <div className="text-right text-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Branch</p>
          <p className="font-medium">{sale.branchName}</p>
          <p className="mt-2 text-xs text-slate-500">Salesperson</p>
          <p>{sale.salespersonName}</p>
          <p className="mt-2 text-xs text-slate-500">Channel · {sale.channel}</p>
        </div>
      </div>

      <table className="invoice-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Discount</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((item) => (
            <tr key={item.productId}>
              <td>{item.name}</td>
              <td>{item.quantity}</td>
              <td>{formatBDT(item.unitPrice)}</td>
              <td>{formatBDT(item.discount)}</td>
              <td className="font-semibold">{formatBDT(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto w-56 space-y-1 text-sm">
        <div className="flex justify-between"><span>Subtotal</span><span>{formatBDT(sale.subtotal)}</span></div>
        <div className="flex justify-between"><span>Discount</span><span>{formatBDT(sale.discount)}</span></div>
        <div className="flex justify-between border-t border-slate-200 py-2 font-bold">
          <span>Total</span>
          <span className="text-red-500">{formatBDT(sale.total)}</span>
        </div>
        <div className="flex justify-between"><span>Paid</span><span>{formatBDT(sale.paidAmount)}</span></div>
        <div className="flex justify-between"><span>Due</span><span>{formatBDT(sale.dueAmount)}</span></div>
        <p className="pt-1 text-xs text-slate-500">{sale.paymentMethod}</p>
      </div>

      {sale.note && (
        <div className="mt-4 rounded border border-slate-200 p-3 text-xs">
          <strong>Note:</strong> {sale.note}
        </div>
      )}

      <p className="mt-8 text-center text-xs text-slate-400">Thank you for shopping with {sale.storeName}</p>
    </div>
  )
}
