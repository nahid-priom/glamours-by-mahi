import type { PrintSaleData } from './print.types'
import { formatBDT, formatDateShort } from '@/lib/format'
import { cn } from '@/lib/utils'

export function PrintSalePosReceipt({
  sale,
  width = '80mm',
}: {
  sale: PrintSaleData
  width?: '58mm' | '80mm'
}) {
  return (
    <div
      className={cn(
        'mx-auto bg-white p-3 font-mono text-[11px] leading-snug text-black',
        width === '58mm' ? 'w-[58mm]' : 'w-[80mm]',
      )}
      style={{ width }}
    >
      <div className="text-center">
        <p className="text-sm font-bold">{sale.storeName}</p>
        <p>{sale.branchName}</p>
        <p className="mt-1">{sale.saleNo}</p>
        <p>{formatDateShort(sale.createdAt)}</p>
      </div>
      <div className="my-2 border-t border-dashed border-black" />
      <p>{sale.customerName}</p>
      <p>{sale.customerPhone}</p>
      <div className="my-2 border-t border-dashed border-black" />
      {sale.items.map((item) => (
        <div key={item.productId} className="mb-1">
          <p className="font-semibold">{item.name}</p>
          <div className="flex justify-between">
            <span>
              {item.quantity} × {formatBDT(item.unitPrice)}
            </span>
            <span>{formatBDT(item.total)}</span>
          </div>
        </div>
      ))}
      <div className="my-2 border-t border-dashed border-black" />
      <div className="flex justify-between"><span>Subtotal</span><span>{formatBDT(sale.subtotal)}</span></div>
      <div className="flex justify-between"><span>Discount</span><span>{formatBDT(sale.discount)}</span></div>
      <div className="flex justify-between text-sm font-bold">
        <span>TOTAL</span>
        <span>{formatBDT(sale.total)}</span>
      </div>
      <div className="flex justify-between"><span>Paid ({sale.paymentMethod})</span><span>{formatBDT(sale.paidAmount)}</span></div>
      <div className="flex justify-between"><span>Due</span><span>{formatBDT(sale.dueAmount)}</span></div>
      <div className="my-2 border-t border-dashed border-black" />
      <p className="text-center">Served by {sale.salespersonName}</p>
      <p className="mt-2 text-center">*** Thank You ***</p>
      <p className="mt-1 text-center tracking-widest">{sale.saleNo}</p>
    </div>
  )
}
