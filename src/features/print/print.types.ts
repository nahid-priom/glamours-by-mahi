export type PrintType = 'invoice' | 'shipping-label' | 'gift-label' | 'pos'

export interface PrintOrderData {
  id: string
  order_id: string
  store_name: string
  customer_name: string
  customer_phone: string
  delivery_address: string
  product_name: string
  sku?: string
  quantity: number
  unit_price?: number
  cod_amount: number
  courier_name?: string
  tracking_id?: string
  status: string
  fraud_level: string
  payment_status?: string
  customer_note?: string
  order_note?: string
  created_at: string
}

export interface PrintSaleData {
  id: string
  saleNo: string
  storeName: string
  branchName: string
  customerName: string
  customerPhone: string
  customerAddress: string
  salespersonName: string
  channel: string
  paymentMethod: string
  items: {
    productId: string
    name: string
    quantity: number
    unitPrice: number
    discount: number
    total: number
  }[]
  subtotal: number
  discount: number
  total: number
  paidAmount: number
  dueAmount: number
  note: string
  status: string
  createdAt: string
}
