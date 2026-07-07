import type { FraudLevel, OrderStatus, PaymentStatus, UserRole } from '@/lib/constants'

export interface BaseEntity {
  id: string
  created_at: string
  updated_at: string
  deleted_at?: string | null
  created_by?: string | null
  updated_by?: string | null
}

export type {
  Store,
  StoreType,
  StoreStatus,
  StoreApiStatus,
  StoreFilters,
  StoreStats,
  StoreFormInput,
} from '@/features/stores/stores.types'

export type { Courier } from '@/features/couriers/couriers.types'

export type { Customer } from '@/features/customers/customers.types'

export interface Product extends BaseEntity {
  name: string
  sku: string
  price: number
  stock: number
  store_id: string
  store_name: string
  status: 'active' | 'inactive' | 'out_of_stock'
}

export interface FraudRisk {
  level: FraudLevel
  score: number
  reasons: string[]
  needs_call_confirmation: boolean
}

export interface Order extends BaseEntity {
  order_id: string
  store_id: string
  store_name: string
  customer_id?: string
  customer_name: string
  customer_phone: string
  /** @deprecated use delivery_address */
  customer_address?: string
  delivery_address: string
  product_id?: string
  product_name: string
  sku?: string
  quantity: number
  unit_price?: number
  cod_amount: number
  courier_id?: string
  courier_name?: string
  tracking_id?: string
  status: OrderStatus
  fraud_level: FraudLevel
  fraud_score: number
  payment_status?: PaymentStatus
  assigned_to?: string
  delivery_area?: string
  customer_note?: string
  /** @deprecated use order_note */
  order_task_note?: string
  order_note?: string
  activity_log?: OrderActivity[]
}

export interface OrderActivity {
  id: string
  message: string
  created_at: string
}

export interface DashboardMetric {
  id: string
  title: string
  value: string | number
  trend: number
  trend_label: string
  icon: string
  color: string
}

export interface ActivityLog extends BaseEntity {
  action: string
  entity_type: string
  entity_id: string
  user_name: string
  details?: string
}

export interface UserProfile {
  id: string
  name: string
  email: string
  role: UserRole
  avatar_url?: string
}

export interface ChartDataPoint {
  name: string
  value?: number
  [key: string]: string | number | undefined
}

export interface TopStoreRow {
  store: string
  orders: number
  collection: number
  growth: number
}

export interface CourierPerformanceRow {
  courier: string
  deliveries: number
  success_rate: number
  rating: number
}

export interface PickupQueueItem {
  hub: string
  count: number
}

export interface DeliveryProgressItem {
  zone: string
  progress: number
}

export interface SmartAlert {
  id: string
  title: string
  description: string
  type: 'warning' | 'danger' | 'info'
  time: string
}

export interface FraudSummary {
  safe: number
  medium: number
  high: number
  blocked: number
  needs_call: number
}

export interface OrderAutomationStatus {
  status: OrderStatus | 'High Fraud Risk'
  count: number
}
