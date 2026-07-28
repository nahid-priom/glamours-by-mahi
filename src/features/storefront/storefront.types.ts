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
  unit?: string
  /** Real Supabase variant data (when loaded from catalog) */
  hasVariants?: boolean
  catalogSizes?: string[]
  catalogColors?: string[]
  catalogVariants?: Array<{
    id: string
    sku: string
    label: string
    sellingPrice: number
    stock: number
    optionValues: Array<{ option: string; value: string }>
    /** Resolved variant-specific image URL when available */
    image?: string | null
  }>
}

export interface CartItem {
  productId: string
  /** Required for Supabase checkout — product_variants.id */
  variantId?: string
  slug: string
  name: string
  sku: string
  price: number
  quantity: number
  image: string
  alt: string
  maxStock: number
  size?: string
  color?: string
  /** Snapshot of the chosen option values, e.g. [{ option: 'Size', value: 'M' }] */
  selectedOptions?: Array<{ option: string; value: string }>
  /** Human label like "Size: M • Color: Pink" */
  variantLabel?: string
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
  publicShareToken?: string
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
  /**
   * Explicit set of category/subcategory slugs to match (self + active
   * descendants). Used by the DB-driven category route so a parent category
   * includes its children. Takes precedence over `category` when present.
   */
  categorySlugs?: string[]
  brand?: string
  style?: StyleTag | 'all'
  sort?: 'newest' | 'price-asc' | 'price-desc' | 'popular'
  onSale?: boolean
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
