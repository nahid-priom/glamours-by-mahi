import type { PrintOrderData } from './print.types'
import type { ShippingLabelSize } from './print.utils'
import { buildTrackingQrValue, getBarcodeValue } from './print.utils'
import { Barcode } from '@/components/common/Barcode'
import { QRCodeBox } from '@/components/common/QRCodeBox'
import { formatBDT } from '@/lib/format'
import { COMPANY_NAME } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface PrintShippingLabelProps {
  order: PrintOrderData
  size?: ShippingLabelSize
}

export function PrintShippingLabel({ order, size = 'standard' }: PrintShippingLabelProps) {
  const barcodeValue = getBarcodeValue(order)
  const qrValue = buildTrackingQrValue(order)
  const showFraud = order.fraud_level === 'HIGH' || order.fraud_level === 'BLOCKED'
  const tracking = order.tracking_id ?? '—'

  const pageClass = cn(
    'print-page print-safe shipping-label thermal-label',
    size === 'standard' && 'shipping-label-page',
    size === 'compact' && 'shipping-label-compact',
    size === 'a4-preview' && 'shipping-label-a4-preview',
  )

  return (
    <div className={pageClass}>
      {/* Header row */}
      <div className="thermal-section thermal-header">
        <div className="min-w-0 flex-1">
          <p className="thermal-store">{order.store_name}</p>
          {showFraud && (
            <span className="thermal-fraud-badge">
              {order.fraud_level} RISK
            </span>
          )}
        </div>
        <div className="thermal-cod-block text-right">
          <p className="thermal-cod-label">COD</p>
          <p className="thermal-cod-amount">{formatBDT(order.cod_amount)}</p>
        </div>
      </div>

      <div className="thermal-divider" />

      {/* Order + tracking */}
      <div className="thermal-section">
        <p className="thermal-label-sm">ORDER</p>
        <p className="thermal-order-id">{order.order_id}</p>
        <p className="thermal-label-sm mt-1">TRACKING</p>
        <p className="thermal-tracking-id">{tracking}</p>
        <p className="thermal-status mt-1">Status: {order.status}</p>
      </div>

      {/* Barcode */}
      <div className="thermal-section thermal-barcode-wrap">
        <Barcode value={barcodeValue} height={size === 'compact' ? 36 : 44} showText />
      </div>

      <div className="thermal-divider" />

      {/* Recipient */}
      <div className="thermal-section">
        <p className="thermal-label-sm">TO</p>
        <p className="thermal-customer-name">{order.customer_name}</p>
        <p className="thermal-phone">{order.customer_phone}</p>
        <p className="thermal-address">{order.delivery_address}</p>
      </div>

      <div className="thermal-divider" />

      {/* Product */}
      <div className="thermal-section">
        <p className="thermal-label-sm">PRODUCT</p>
        <p className="thermal-product">
          {order.product_name} × {order.quantity}
        </p>
        {order.sku && <p className="thermal-sku">SKU: {order.sku}</p>}
      </div>

      {/* Courier */}
      <div className="thermal-section">
        <p className="thermal-label-sm">COURIER</p>
        <p className="thermal-courier">{order.courier_name ?? 'Not assigned'}</p>
      </div>

      {/* QR + footer */}
      <div className="thermal-section thermal-footer-row">
        <QRCodeBox value={qrValue} size={size === 'compact' ? 56 : 64} />
        <div className="thermal-care-badge">HANDLE WITH CARE</div>
      </div>

      <p className="thermal-powered">Powered by {COMPANY_NAME}</p>
    </div>
  )
}
