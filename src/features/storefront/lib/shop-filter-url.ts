import type { StyleTag } from '@/lib/fashion-catalog'
import type { StorefrontCategorySlug } from '@/lib/constants'
import type { StorefrontFilters } from '@/features/storefront/storefront.types'

/** Shared URL query contract for /shop filter redirects (hero CTAs, campaigns, toolbar). */
export const SHOP_FILTER_PARAMS = {
  category: 'category',
  brand: 'brand',
  sort: 'sort',
  onSale: 'onSale',
  style: 'style',
  minPrice: 'minPrice',
  maxPrice: 'maxPrice',
  q: 'q',
} as const

export type ShopSort = NonNullable<StorefrontFilters['sort']>

const SORT_VALUES: ShopSort[] = ['newest', 'price-asc', 'price-desc', 'popular']

function parseNumber(value: string | null): number | undefined {
  if (value == null || value === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

export function parseShopFiltersFromSearchParams(
  params: URLSearchParams,
): StorefrontFilters {
  const category = params.get(SHOP_FILTER_PARAMS.category)
  const brand = params.get(SHOP_FILTER_PARAMS.brand)
  const sortRaw = params.get(SHOP_FILTER_PARAMS.sort)
  const onSale = params.get(SHOP_FILTER_PARAMS.onSale)
  const style = params.get(SHOP_FILTER_PARAMS.style)
  const search = params.get(SHOP_FILTER_PARAMS.q)
  const minPrice = parseNumber(params.get(SHOP_FILTER_PARAMS.minPrice))
  const maxPrice = parseNumber(params.get(SHOP_FILTER_PARAMS.maxPrice))

  const sort = SORT_VALUES.includes(sortRaw as ShopSort)
    ? (sortRaw as ShopSort)
    : 'newest'

  return {
    category: (category as StorefrontCategorySlug | 'all' | null) ?? 'all',
    brand: brand?.trim() || undefined,
    sort,
    onSale: onSale === 'true' || onSale === '1',
    style: (style as StyleTag | 'all' | null) ?? 'all',
    search: search?.trim() || undefined,
    minPrice,
    maxPrice,
    pageSize: 24,
  }
}

export function buildShopSearchParams(filters: StorefrontFilters): URLSearchParams {
  const params = new URLSearchParams()

  if (filters.category && filters.category !== 'all') {
    params.set(SHOP_FILTER_PARAMS.category, filters.category)
  }
  if (filters.brand?.trim()) {
    params.set(SHOP_FILTER_PARAMS.brand, filters.brand.trim())
  }
  if (filters.sort && filters.sort !== 'newest') {
    params.set(SHOP_FILTER_PARAMS.sort, filters.sort)
  }
  if (filters.onSale) {
    params.set(SHOP_FILTER_PARAMS.onSale, 'true')
  }
  if (filters.style && filters.style !== 'all') {
    params.set(SHOP_FILTER_PARAMS.style, filters.style)
  }
  if (filters.minPrice != null && filters.minPrice > 0) {
    params.set(SHOP_FILTER_PARAMS.minPrice, String(filters.minPrice))
  }
  if (filters.maxPrice != null) {
    params.set(SHOP_FILTER_PARAMS.maxPrice, String(filters.maxPrice))
  }
  if (filters.search?.trim()) {
    params.set(SHOP_FILTER_PARAMS.q, filters.search.trim())
  }

  return params
}

export function buildShopUrl(filters: StorefrontFilters): string {
  const params = buildShopSearchParams(filters)
  const qs = params.toString()
  return qs ? `/shop?${qs}` : '/shop'
}
