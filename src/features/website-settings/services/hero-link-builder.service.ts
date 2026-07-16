import { buildShopUrl } from '@/features/storefront/lib/shop-filter-url'
import type { StorefrontFilters } from '@/features/storefront/storefront.types'
import type { HeroCtaConfig, HeroCtaType } from '../types/hero.types'

export function buildHeroCtaUrl(type: HeroCtaType, config: HeroCtaConfig = {}): string {
  switch (type) {
    case 'all_products':
      return '/shop'
    case 'category':
      return buildShopUrl({
        category: (config.category as StorefrontFilters['category']) || 'all',
      })
    case 'subcategory':
      return buildShopUrl({
        category: (config.category as StorefrontFilters['category']) || 'all',
        search: config.subcategory,
      })
    case 'brand':
      return buildShopUrl({ brand: config.brand })
    case 'new_arrivals':
      return buildShopUrl({ sort: 'newest', category: 'new-arrival' })
    case 'best_sellers':
      return buildShopUrl({ sort: 'popular', category: 'best-seller' })
    case 'featured':
      return buildShopUrl({ sort: 'popular' })
    case 'on_sale':
      return buildShopUrl({ onSale: true, category: 'sale' })
    case 'custom_filter':
      return buildShopUrl({
        category: (config.category as StorefrontFilters['category']) || 'all',
        brand: config.brand,
        sort: (config.sort as StorefrontFilters['sort']) || 'newest',
        minPrice: config.minPrice,
        maxPrice: config.maxPrice,
        onSale: config.onSale,
        style: (config.style as StorefrontFilters['style']) || 'all',
        search: config.search,
      })
    case 'product':
      return config.productSlug ? `/product/${config.productSlug}` : '/shop'
    case 'custom_url': {
      const url = config.customUrl?.trim()
      if (!url) return '/shop'
      if (url.startsWith('/')) return url
      if (url.startsWith('http://') || url.startsWith('https://')) return url
      return `/${url}`
    }
    default:
      return '/shop'
  }
}

export function resolveCtaHref(
  type: HeroCtaType | null | undefined,
  config: HeroCtaConfig | null | undefined,
  storedUrl?: string | null,
): string {
  if (storedUrl?.trim()) return storedUrl.trim()
  if (!type) return '/shop'
  return buildHeroCtaUrl(type, config ?? {})
}
