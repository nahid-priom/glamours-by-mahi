import type { StorefrontProduct } from '../storefront.types'
import { getDisplayCategory, getDisplayName, getDisplayPrice, getDisplayRating, getDisplayReviewCount, getDisplayStock } from '../utils/product-display'

export interface BadgeItem {
  label: string
  className: string
}

interface BadgeCandidate extends BadgeItem {
  priority: number
}

export function getCardProductName(product: StorefrontProduct): string {
  return getDisplayName(product)
}

export function getCardCategory(product: StorefrontProduct): string {
  return getDisplayCategory(product).toUpperCase()
}

export function getCardPrice(product: StorefrontProduct): number {
  return getDisplayPrice(product)
}

export function buildBadges(product: StorefrontProduct, discount: number): BadgeItem[] {
  const candidates: BadgeCandidate[] = []
  const stock = getDisplayStock(product)

  if (product.onSale && discount > 0) {
    candidates.push({
      label: `-${discount}%`,
      className: 'bg-[#FF3F7F] text-white',
      priority: 1,
    })
  }
  if (product.isFeatured || product.isTrending) {
    candidates.push({
      label: 'HOT',
      className: 'bg-[#22171C] text-white',
      priority: 2,
    })
  }
  if (stock > 0 && stock <= 5) {
    candidates.push({
      label: 'Low Stock',
      className: 'bg-amber-500 text-white',
      priority: 3,
    })
  }
  if (product.isBestSeller) {
    candidates.push({
      label: 'Bestseller',
      className: 'bg-[#22171C]/90 text-white backdrop-blur-sm',
      priority: 4,
    })
  }
  if (product.isLimited) {
    candidates.push({
      label: 'Limited',
      className: 'bg-white/95 text-[#22171C] backdrop-blur-sm',
      priority: 5,
    })
  }

  return candidates.sort((a, b) => a.priority - b.priority).slice(0, 2)
}

export function getProductDiscount(product: StorefrontProduct): number {
  const regular = Number(product.price)
  const sale = Number(product.salePrice)
  if (!product.onSale || !Number.isFinite(regular) || !Number.isFinite(sale)) return 0
  if (regular <= 0 || sale <= 0 || regular <= sale) return 0
  const discount = Math.round(((regular - sale) / regular) * 100)
  return discount > 0 && discount < 100 ? discount : 0
}

export function showStockPill(product: StorefrontProduct): boolean {
  const stock = getDisplayStock(product)
  return stock > 5 && stock <= 8
}

export function getCardRating(product: StorefrontProduct): number {
  return getDisplayRating(product)
}

export function getCardReviewCount(product: StorefrontProduct): number {
  return getDisplayReviewCount(product)
}
