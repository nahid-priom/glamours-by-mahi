import type { PrintOrderData } from './print.types'

export type ShippingLabelSize = 'standard' | 'compact' | 'a4-preview'

export function buildTrackingQrValue(order: PrintOrderData): string {
  return [
    order.order_id,
    order.tracking_id ?? order.order_id,
    order.customer_phone,
    order.courier_name ?? 'N/A',
  ].join(' | ')
}

export function getBarcodeValue(order: PrintOrderData): string {
  return order.tracking_id ?? order.order_id
}
