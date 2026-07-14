import { getCategoryLabel } from '../lib/shop-utils'
import type { StorefrontProduct } from '../storefront.types'
import { safeProductName } from './product-slug'
import {
  getProductCoverImage,
  getProductGalleryImages,
} from '@/lib/images/product-image-utils'
import { getFallbackImage } from '@/lib/images/image-utils'

export function getDisplayName(product: StorefrontProduct): string {
  return safeProductName(product.name)
}

export function getDisplayCategory(product: StorefrontProduct): string {
  const label = getCategoryLabel(product.category)
  if (!label || label.includes('undefined')) return 'Collection'
  return label
}

export function getDisplayDescription(product: StorefrontProduct): string {
  const desc = product.description?.trim()
  if (!desc || desc.includes('undefined')) {
    return `${getDisplayName(product)} — thoughtfully designed with premium fabrics, refined fit, and nationwide COD delivery.`
  }
  return desc
}

export function getDisplayPrice(product: StorefrontProduct): number {
  const price = product.displayPrice ?? product.price
  return Number.isFinite(price) && price > 0 ? price : 0
}

export function getOriginalPrice(product: StorefrontProduct): number {
  const price = product.price
  return Number.isFinite(price) && price > 0 ? price : getDisplayPrice(product)
}

export function getDisplayStock(product: StorefrontProduct): number {
  const stock = product.stock
  return Number.isFinite(stock) && stock >= 0 ? stock : 0
}

export function getDisplayRating(product: StorefrontProduct): number {
  const rating = product.rating
  return Number.isFinite(rating) && rating > 0 ? rating : 4.5
}

export function getDisplayReviewCount(product: StorefrontProduct): number {
  const count = product.reviewCount
  return Number.isFinite(count) && count >= 0 ? count : 0
}

export function getDisplayGallery(product: StorefrontProduct): string[] {
  return getProductGalleryImages(product).slice(0, 5)
}

export function getDisplayImage(product: StorefrontProduct): string {
  return getProductCoverImage(product) || getFallbackImage()
}

export function getDisplayAlt(product: StorefrontProduct): string {
  const alt = product.alt?.trim()
  if (!alt || alt.includes('undefined')) return getDisplayName(product)
  return alt
}

export function getDiscountPercent(product: StorefrontProduct): number {
  if (!product.onSale || !product.salePrice) return 0
  const original = getOriginalPrice(product)
  if (original <= 0) return 0
  return Math.round(((original - product.salePrice) / original) * 100)
}

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock'

export function getStockStatus(product: StorefrontProduct): StockStatus {
  const stock = getDisplayStock(product)
  if (stock <= 0) return 'out_of_stock'
  if (stock <= 8) return 'low_stock'
  return 'in_stock'
}
