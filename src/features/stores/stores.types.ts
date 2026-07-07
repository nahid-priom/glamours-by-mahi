import type { BaseEntity } from '@/types'

export type StoreType = 'facebook' | 'shopify' | 'woocommerce' | 'instagram' | 'manual'
export type StoreStatus = 'active' | 'inactive' | 'archived'
export type StoreApiStatus = 'connected' | 'not_connected' | 'error'

export interface Store extends BaseEntity {
  name: string
  type: StoreType
  logo_url?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  invoice_prefix: string
  default_courier_id?: string | null
  status: StoreStatus
  api_status: StoreApiStatus
}

export interface StoreFilters {
  search?: string
  type?: StoreType | 'all'
  status?: StoreStatus | 'all'
  api_status?: StoreApiStatus | 'all'
  include_deleted?: boolean
}

export interface StoreStats {
  total: number
  active: number
  connected: number
  inactive: number
}

export interface StoreFormInput {
  name: string
  type: StoreType
  logo_url?: string
  phone?: string
  email?: string
  address?: string
  invoice_prefix: string
  default_courier_id?: string
  status: StoreStatus
  api_status: StoreApiStatus
}
