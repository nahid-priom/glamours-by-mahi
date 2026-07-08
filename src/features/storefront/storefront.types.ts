import type { Product } from '@/types'
import type { StorefrontCategorySlug } from '@/lib/constants'
import type { StyleTag } from '@/lib/fashion-catalog'
import type { Order } from '@/types'

export interface StorefrontProduct extends Product {
  slug: string
  category: StorefrontCategorySlug
  catalogCategory: string
  tags: string[]
  style: StyleTag
  description: string
  image: string
  hoverImage: string
  gallery: string[]
  alt: string
  isNew: boolean
  isTrending: boolean
  isFeatured: boolean
  isBestSeller: boolean
  isLimited: boolean
  onSale: boolean
  salePrice?: number
  displayPrice: number
  rating: number
  reviewCount: number
}

export interface CartItem {
  productId: string
  slug: string
  name: string
  sku: string
  price: number
  quantity: number
  image: string
  alt: string
  maxStock: number
}

export interface CartState {
  items: CartItem[]
  updatedAt: string
}

export interface CheckoutInput {
  customer_name: string
  phone: string
  email?: string
  address: string
  district: string
  delivery_area: string
  notes?: string
}

export interface CheckoutResult {
  orderIds: string[]
  primaryOrderId: string
  primaryOrderNumber: string
  invoiceId: string
  invoiceNo: string
  fraudLevel: string
  fraudScore: number
  totalCod: number
  deliveryCharge: number
}

export interface AccountSession {
  phone: string
  name: string
  email?: string
  address?: string
  district?: string
}

export interface StorefrontFilters {
  search?: string
  category?: StorefrontCategorySlug | 'all'
  style?: StyleTag | 'all'
  sort?: 'newest' | 'price-asc' | 'price-desc' | 'popular'
  minPrice?: number
  maxPrice?: number
  page?: number
  pageSize?: number
}

export interface StorefrontListResult {
  products: StorefrontProduct[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface OrderTrackingInfo {
  orders: Order[]
  timeline: { status: string; date: string; done: boolean }[]
}

export interface WishlistItem {
  productId: string
  slug: string
  addedAt: string
}

export type ProductCardVariant = 'default' | 'large' | 'compact' | 'editorial'
