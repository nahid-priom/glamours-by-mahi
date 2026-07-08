import { STOREFRONT_CATEGORIES } from '@/lib/constants'
import type { StorefrontFilters } from '../storefront.types'

export const DEFAULT_SHOP_FILTERS: StorefrontFilters = {
  sort: 'newest',
  category: 'all',
  style: 'all',
  pageSize: 24,
}

export function getCategoryLabel(slug: string): string {
  return STOREFRONT_CATEGORIES.find((c) => c.slug === slug)?.label ?? slug.replace(/-/g, ' ')
}

export function countActiveFilters(filters: StorefrontFilters): number {
  let count = 0
  if (filters.category && filters.category !== 'all') count++
  if (filters.style && filters.style !== 'all') count++
  if (filters.minPrice !== undefined && filters.minPrice > 0) count++
  if (filters.maxPrice !== undefined) count++
  if (filters.search?.trim()) count++
  return count
}

export function formatShowingRange(page: number, pageSize: number, total: number, loaded: number): string {
  if (total === 0) return 'Showing 0 products'
  const start = (page - 1) * pageSize + 1
  const end = Math.min(loaded, total)
  return `Showing ${start}-${end} of ${total} products`
}
