import type { PrintSaleData, ThermalWidth } from './print.types'
import { formatBDT, formatDateShort } from '@/lib/format'
import { cn } from '@/lib/utils'

export function PrintSalePosReceipt({
  sale,
  width = '80mm',
}: {
  sale: PrintSaleData
  width?: ThermalWidth
}) {
  const pageClass = width === '58mm' ? 'pos-receipt-58' : 'pos-receipt-80'

  return (
    <div
      className={cn(
        'pos-receipt print-page mx-auto bg-white font-mono text-black',
        pageClass,
        width === '58mm' ? 'text-[10px] leading-snug' : 'text-[11px] leading-snug',
      )}
    >
      <div className="text-center">
        <p className={cn('font-bold', width === '58mm' ? 'text-xs' : 'text-sm')}>{sale.storeName}</p>
        <p className="font-semibold">{sale.branchName}</p>
        {sale.branchAddress ? <p>{sale.branchAddress}</p> : null}
        {sale.branchPhone ? <p>Tel: {sale.branchPhone}</p> : null}
        <p className="mt-1 font-semibold">{sale.saleNo}</p>
        <p>{formatDateShort(sale.createdAt)}</p>
      </div>

      <div className="pos-receipt-divider" />

      <div>
        <p>
          <span className="opacity-70">Customer: </span>
          {sale.customerName}
        </p>
        {sale.customerPhone ? <p>{sale.customerPhone}</p> : null}
        <p>
          <span className="opacity-70">Cashier: </span>
          {sale.salespersonName}
        </p>
      </div>

      <div className="pos-receipt-divider" />

      {sale.items.map((item) => (
        <div key={`${item.productId}-${item.name}`} className="mb-1.5">
          <p className="font-semibold">{item.name}</p>
          {item.barcode ? <p className="opacity-70">{item.barcode}</p> : null}
          <div className="flex justify-between gap-2">
            <span>
              {item.quantity} × {formatBDT(item.unitPrice)}
              {item.discount > 0 ? ` −${formatBDT(item.discount)}` : ''}
            </span>
            <span className="font-semibold">{formatBDT(item.total)}</span>
          </div>
        </div>
      ))}

      <div className="pos-receipt-divider" />

      <div className="flex justify-between">
        <span>Subtotal</span>
        <span>{formatBDT(sale.subtotal)}</span>
      </div>
      <div className="flex justify-between">
        <span>Discount</span>
        <span>{formatBDT(sale.discount)}</span>
      </div>
      <div className={cn('flex justify-between font-bold', width === '58mm' ? 'text-xs' : 'text-sm')}>
        <span>TOTAL</span>
        <span>{formatBDT(sale.total)}</span>
      </div>
      <div className="flex justify-between">
        <span>Paid ({sale.paymentMethod})</span>
        <span>{formatBDT(sale.paidAmount)}</span>
      </div>
      <div className="flex justify-between">
        <span>Due</span>
        <span>{formatBDT(sale.dueAmount)}</span>
      </div>

      {sale.payments?.length ? (
        <>
          <div className="pos-receipt-divider" />
          {sale.payments.map((p, i) => (
            <div key={`${p.method}-${i}`} className="flex justify-between">
              <span>
                {p.method}
                {p.reference ? ` · ${p.reference}` : ''}
              </span>
              <span>{formatBDT(p.amount)}</span>
            </div>
          ))}
        </>
      ) : null}

      <div className="pos-receipt-divider" />

      {sale.barcodeValue ? (
        <div className="my-2 text-center">
          <p className="tracking-[0.25em]">{sale.barcodeValue}</p>
          <p className="mt-1 text-[9px] opacity-70">Invoice barcode / QR reference</p>
        </div>
      ) : null}

      <p className="text-center font-semibold">*** Thank You ***</p>
      <p className="mt-1 text-center text-[9px] opacity-80">
        Returns accepted with original invoice within store policy.
      </p>
      <p className="pos-receipt-powered mt-2 text-center">
        Powered by <span className="brand-gradient-text font-semibold">Code Bondhu IT</span>
      </p>
    </div>
  )
}
