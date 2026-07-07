import type { Product } from '@/types'

export type ProductStatus = 'active' | 'inactive' | 'out_of_stock'

export interface ProductFilters {
  search?: string
  store?: string
  status?: ProductStatus | 'all'
  include_deleted?: boolean
}

export interface ProductStats {
  total: number
  active: number
  low_stock: number
  out_of_stock: number
}

export interface ProductFormInput {
  name: string
  sku: string
  price: number
  stock: number
  store_id: string
  status: ProductStatus
}

export type { Product }
