import type { OrderStatus, FraudLevel, PaymentStatus } from '@/lib/constants'
import type { Order, OrderActivity } from '@/types'

export interface OrderFilters {
  search?: string
  status?: OrderStatus | 'all'
  store?: string
  courier?: string
  fraud_level?: string
  include_deleted?: boolean
}

export interface OrderStats {
  total: number
  new: number
  confirmed: number
  packed: number
  courier_booked: number
  shipped: number
  delivered: number
  returned: number
  cancelled: number
  high_fraud: number
}

export interface CreateOrderInput {
  store_id: string
  customer_name: string
  customer_phone: string
  delivery_address: string
  customer_id?: string
  product_id?: string
  product_name: string
  sku?: string
  quantity: number
  unit_price: number
  cod_amount: number
  courier_id?: string
  courier_name?: string
  delivery_area?: string
  customer_note?: string
  order_note?: string
  fraud_level: FraudLevel
  fraud_score: number
  assigned_to?: string
}

export interface UpdateOrderInput extends Partial<CreateOrderInput> {
  status?: OrderStatus
  payment_status?: PaymentStatus
  tracking_id?: string
}

export type { Order, OrderActivity, OrderStatus, FraudLevel, PaymentStatus }
