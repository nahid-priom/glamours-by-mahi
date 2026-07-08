import type { OrderStatus } from '@/lib/constants'

export interface AccountSession {
  phone: string
  name: string
  email?: string
  address?: string
  district?: string
  delivery_area?: string
}

export type AddressLabel = 'Home' | 'Office' | 'Other'

export interface SavedAddress {
  id: string
  fullName: string
  phone: string
  district: string
  area: string
  address: string
  label: AddressLabel
  isDefault: boolean
}

export interface AccountStats {
  totalOrders: number
  delivered: number
  inProgress: number
  returned: number
  totalSpent: number
  wishlistCount: number
}

export interface AccountOrderFilters {
  search?: string
  status?: OrderStatus | 'all'
}
