import type { PrintOrderData, PrintSaleData } from './print.types'
import type { Order } from '@/types'
import { ordersService } from '@/features/storefront/legacy-oms/orders.service'
import { getSale } from '@/features/sales/repositories/sales.repository'
import { supabase } from '@/lib/supabase/client'

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

export async function saleToPrintData(saleId: string): Promise<PrintSaleData | null> {
  const sale = await getSale(saleId)
  if (!sale || sale.deleted_at) return null

  const [{ data: org }, { data: profiles }] = await Promise.all([
    supabase
      .from('organizations')
      .select('name')
      .eq('id', sale.organization_id)
      .maybeSingle(),
    sale.salesperson_id
      ? supabase
          .from('profiles')
          .select('full_name')
          .eq('id', sale.salesperson_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const paymentMethod =
    (sale.sale_payments ?? [])
      .map((p) => p.method)
      .filter(Boolean)
      .join(' + ') || sale.payment_status

  const payments = (sale.sale_payments ?? [])
    .filter((p) => !p.deleted_at)
    .map((p) => ({
      method: p.method,
      amount: Number(p.amount),
      reference: p.reference,
    }))

  return {
    id: sale.id,
    saleNo: sale.invoice_no,
    storeName: org?.name || 'Store',
    branchName: sale.branches?.name ?? '—',
    branchAddress: sale.branches?.address ?? undefined,
    branchPhone: sale.branches?.phone ?? undefined,
    customerName: sale.customers?.name ?? 'Walk-in',
    customerPhone: sale.customers?.phone ?? '',
    customerAddress: '',
    salespersonName: profiles?.full_name ?? '—',
    channel: 'pos',
    paymentMethod,
    payments,
    items: (sale.sale_items ?? [])
      .filter((i) => !i.deleted_at)
      .map((i) => ({
        productId: i.variant_id,
        name:
          i.product_variants?.products?.name ||
          i.product_variants?.name ||
          i.product_variants?.sku ||
          'Item',
        barcode: i.product_variants?.barcode ?? null,
        quantity: Number(i.qty),
        unitPrice: Number(i.unit_price),
        discount: Number(i.line_discount ?? 0),
        total: Number(i.line_total),
      })),
    subtotal: Number(sale.subtotal),
    discount: Number(sale.discount),
    total: Number(sale.grand_total),
    paidAmount: Number(sale.paid_total),
    dueAmount: Number(sale.due_total),
    note: sale.note ?? '',
    status: sale.status,
    createdAt: sale.completed_at ?? sale.created_at,
    barcodeValue: sale.invoice_no,
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
