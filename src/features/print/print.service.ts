import type { PrintOrderData } from './print.types'
import type { Order } from '@/types'
import { ordersService } from '@/features/orders/orders.service'

export function orderToPrintData(order: Order): PrintOrderData {
  return {
    id: order.id,
    order_id: order.order_id,
    store_name: order.store_name,
    customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    delivery_address: order.delivery_address ?? order.customer_address ?? '',
    product_name: order.product_name,
    sku: order.sku,
    quantity: order.quantity,
    unit_price: order.unit_price,
    cod_amount: order.cod_amount,
    courier_name: order.courier_name,
    tracking_id: order.tracking_id,
    status: order.status,
    fraud_level: order.fraud_level,
    payment_status: order.payment_status,
    customer_note: order.customer_note,
    order_note: order.order_note ?? order.order_task_note,
    created_at: order.created_at,
  }
}

export const printService = {
  async getOrderForPrint(id: string): Promise<PrintOrderData | null> {
    const order = await ordersService.getOrderById(id)
    if (!order || order.deleted_at) return null
    return orderToPrintData(order)
  },

  async getOrdersForBulkPrint(ids: string[]): Promise<PrintOrderData[]> {
    const orders = await ordersService.getOrdersByIds(ids)
    return orders.map(orderToPrintData)
  },

  triggerPrint() {
    window.print()
  },
}
