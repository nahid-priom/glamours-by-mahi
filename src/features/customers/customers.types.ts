import type { FraudLevel } from '@/lib/constants'

export type CustomerStatus = 'active' | 'blocked' | 'archived'

export interface Customer {
  id: string
  name: string
  phone: string
  email: string
  address: string
  district: string
  total_orders: number
  delivered_orders: number
  returned_orders: number
  cancelled_orders: number
  total_spent: number
  return_rate: number
  fraud_level: FraudLevel
  is_blacklisted: boolean
  blacklist_reason: string | null
  customer_note: string
  status: CustomerStatus
  created_at: string
  updated_at: string
  deleted_at?: string | null
  created_by?: string | null
  updated_by?: string | null
}

export interface CustomerFilters {
  search?: string
  status?: CustomerStatus | 'all'
  fraud_level?: FraudLevel | 'all'
  is_blacklisted?: boolean | 'all'
  include_deleted?: boolean
}

export interface CustomerStats {
  total: number
  active: number
  blocked: number
  blacklisted: number
  high_risk: number
  avg_return_rate: number
}

export interface CustomerFormInput {
  name: string
  phone: string
  email: string
  address: string
  district: string
  status: CustomerStatus
}
