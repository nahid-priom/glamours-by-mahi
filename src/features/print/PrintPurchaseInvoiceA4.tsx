import type { PrintPurchaseData } from './print.types'
import { formatBDT, formatDateShort } from '@/lib/format'

export function PrintPurchaseInvoiceA4({ purchase }: { purchase: PrintPurchaseData }) {
  return (
    <div className="print-page invoice-page">
      <div className="invoice-header">
        <div>
          <h1 className="text-xl font-bold">{purchase.storeName}</h1>
          <p className="text-xs text-slate-500">Purchase Invoice / Supplier Receipt</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-bold text-red-500">PURCHASE</p>
          <p className="font-mono font-semibold">{purchase.purchaseNo}</p>
          <p className="text-xs text-slate-500">{formatDateShort(purchase.createdAt)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Supplier</p>
          <p className="font-semibold">{purchase.supplierName}</p>
          {purchase.supplierPhone ? <p>{purchase.supplierPhone}</p> : null}
          {purchase.supplierAddress ? (
            <p className="mt-1 text-slate-600">{purchase.supplierAddress}</p>
          ) : null}
        </div>
        <div className="text-right text-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Receiving Branch</p>
          <p className="font-medium">{purchase.branchName}</p>
          {purchase.branchAddress ? <p className="text-slate-600">{purchase.branchAddress}</p> : null}
          {purchase.branchPhone ? <p className="text-slate-600">{purchase.branchPhone}</p> : null}
          <p className="mt-2 text-xs text-slate-500">Status · {purchase.status}</p>
          <p className="text-xs text-slate-500">Payment · {purchase.paymentStatus}</p>
        </div>
      </div>

      <table className="invoice-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Qty</th>
            <th>Unit Cost</th>
            <th>Discount</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {purchase.items.map((item) => (
            <tr key={item.variantId}>
              <td>
                <div>{item.name}</div>
                {item.sku ? <div className="text-xs text-slate-500">{item.sku}</div> : null}
              </td>
              <td>{item.quantity}</td>
              <td>{formatBDT(item.unitCost)}</td>
              <td>{formatBDT(item.discount)}</td>
              <td className="font-semibold">{formatBDT(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto w-56 space-y-1 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatBDT(purchase.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>Discount</span>
          <span>{formatBDT(purchase.discount)}</span>
        </div>
        {purchase.tax > 0 ? (
          <div className="flex justify-between">
            <span>Tax</span>
            <span>{formatBDT(purchase.tax)}</span>
          </div>
        ) : null}
        {purchase.shipping > 0 ? (
          <div className="flex justify-between">
            <span>Shipping</span>
            <span>{formatBDT(purchase.shipping)}</span>
          </div>
        ) : null}
        <div className="flex justify-between border-t border-slate-200 py-2 font-bold">
          <span>Total</span>
          <span className="text-red-500">{formatBDT(purchase.total)}</span>
        </div>
        <div className="flex justify-between">
          <span>Paid</span>
          <span>{formatBDT(purchase.paidAmount)}</span>
        </div>
        <div className="flex justify-between">
          <span>Due</span>
          <span>{formatBDT(purchase.dueAmount)}</span>
        </div>
        <p className="pt-1 text-xs text-slate-500">{purchase.paymentMethod}</p>
      </div>

      {purchase.note ? (
        <div className="mt-4 rounded border border-slate-200 p-3 text-xs">
          <strong>Note:</strong> {purchase.note}
        </div>
      ) : null}

      <p className="mt-8 text-center text-xs text-slate-400">
        Purchase record for {purchase.storeName}
      </p>
    </div>
  )
}
