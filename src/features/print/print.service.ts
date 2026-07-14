import type { PrintOrderData, PrintSaleData } from './print.types'
import type { Order } from '@/types'
import { ordersService } from '@/features/orders/orders.service'
import { salesService } from '@/services/sales.service'
import { peekDatabase } from '@/database/transaction'

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

export function saleToPrintData(saleId: string): PrintSaleData | null {
  const detail = salesService.getDetail(saleId)
  if (!detail || detail.sale.deleted_at) return null
  const { sale, customer, branch, salesperson } = detail
  const db = peekDatabase()
  return {
    id: sale.id,
    saleNo: sale.saleNo,
    storeName: db.meta.brand || 'Store',
    branchName: branch?.name ?? '—',
    customerName: customer?.name ?? '—',
    customerPhone: customer?.phone ?? '',
    customerAddress: customer?.address ?? '',
    salespersonName: salesperson?.name ?? '—',
    channel: sale.channel,
    paymentMethod: sale.paymentMethod,
    items: sale.items.map((i) => ({
      productId: i.productId,
      name: i.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      discount: i.discount,
      total: i.total,
    })),
    subtotal: sale.subtotal,
    discount: sale.discount,
    total: sale.total,
    paidAmount: sale.paidAmount,
    dueAmount: sale.dueAmount,
    note: sale.note,
    status: sale.status,
    createdAt: sale.created_at,
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

  async getSaleForPrint(id: string): Promise<PrintSaleData | null> {
    return saleToPrintData(id)
  },

  triggerPrint() {
    window.print()
  },
}
