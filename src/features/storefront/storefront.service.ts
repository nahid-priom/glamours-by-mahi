import type { StyleTag } from '@/lib/fashion-catalog'
import {
  fetchPublishedCatalog,
  fetchPublishedProductById,
  invalidateStorefrontOrgCache,
} from './repositories/storefront-catalog.repository'
import { trackOnlineSale } from './repositories/storefront-orders.repository'
import { mapCatalogToStorefront } from './utils/map-catalog-product'
import type {
  StorefrontFilters,
  StorefrontListResult,
  StorefrontProduct,
  OrderTrackingInfo,
} from './storefront.types'
import type { OrderStatus } from '@/lib/constants'
import { matchesProductSlug } from './utils/product-slug'

const delay = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms))

function applyStorefrontFilters(products: StorefrontProduct[], filters?: StorefrontFilters): StorefrontProduct[] {
  let result = [...products]

  if (filters?.search) {
    const q = filters.search.toLowerCase()
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.catalogVariants ?? []).some(
          (v) => v.sku.toLowerCase().includes(q) || v.label.toLowerCase().includes(q),
        ),
    )
  }

  const categoryFilter = filters?.category
  if (categoryFilter && categoryFilter !== 'all') {
    result = result.filter((p) => p.tags.includes(categoryFilter) || p.category === categoryFilter)
  }

  if (filters?.style && filters.style !== 'all') {
    result = result.filter((p) => p.style === filters.style)
  }

  if (filters?.brand?.trim()) {
    const brand = filters.brand.trim().toLowerCase()
    result = result.filter((p) =>
      p.tags.some((t) => t.toLowerCase() === brand || t.toLowerCase().includes(brand)),
    )
  }

  if (filters?.onSale) {
    result = result.filter((p) => p.onSale || p.tags.includes('sale') || p.category === 'sale')
  }

  if (filters?.minPrice !== undefined) {
    result = result.filter((p) => p.displayPrice >= filters.minPrice!)
  }
  if (filters?.maxPrice !== undefined) {
    result = result.filter((p) => p.displayPrice <= filters.maxPrice!)
  }

  switch (filters?.sort) {
    case 'price-asc':
      result.sort((a, b) => a.displayPrice - b.displayPrice)
      break
    case 'price-desc':
      result.sort((a, b) => b.displayPrice - a.displayPrice)
      break
    case 'popular':
      result.sort((a, b) => b.reviewCount - a.reviewCount || Number(b.isBestSeller) - Number(a.isBestSeller))
      break
    default:
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }

  return result
}

function isShopVisible(product: StorefrontProduct): boolean {
  return product.status === 'active' && product.stock > 0
}

const STATUS_TIMELINE: OrderStatus[] = ['New', 'Confirmed', 'Packed', 'Courier Booked', 'Shipped', 'Delivered']

let cachedCatalog: StorefrontProduct[] | null = null

async function loadCatalog(): Promise<StorefrontProduct[]> {
  if (cachedCatalog) return cachedCatalog
  const rows = await fetchPublishedCatalog()
  cachedCatalog = await Promise.all(rows.map(mapCatalogToStorefront))
  return cachedCatalog
}

export function invalidateStorefrontCache() {
  cachedCatalog = null
  invalidateStorefrontOrgCache()
}

export const storefrontService = {
  async getShopProducts(filters?: StorefrontFilters): Promise<StorefrontListResult> {
    await delay()
    const all = (await loadCatalog()).filter(isShopVisible)
    const filtered = applyStorefrontFilters(all, filters)
    const page = filters?.page ?? 1
    const pageSize = filters?.pageSize ?? 24
    const start = (page - 1) * pageSize
    return {
      products: filtered.slice(start, start + pageSize),
      total: filtered.length,
      page,
      pageSize,
      hasMore: start + pageSize < filtered.length,
    }
  },

  async getProductBySlug(slug: string): Promise<StorefrontProduct | null> {
    await delay(40)
    const trimmed = slug?.trim()
    if (!trimmed) return null

    const all = await loadCatalog()
    const direct = all.find((p) => p.slug === trimmed || matchesProductSlug(p.slug, trimmed))
    if (direct) return direct

    return all.find((p) => p.id === trimmed) ?? null
  },

  async getProductById(id: string): Promise<StorefrontProduct | null> {
    await delay(40)
    const row = await fetchPublishedProductById(id)
    if (!row) return null
    return mapCatalogToStorefront(row)
  },

  async getNewArrivals(limit = 12): Promise<StorefrontProduct[]> {
    const all = (await loadCatalog()).filter(isShopVisible)
    return all.filter((p) => p.isNew).slice(0, limit)
  },

  async getTrending(limit = 12): Promise<StorefrontProduct[]> {
    const all = (await loadCatalog()).filter(isShopVisible)
    return all.filter((p) => p.isTrending).slice(0, limit)
  },

  async getFeatured(limit = 8): Promise<StorefrontProduct[]> {
    const all = (await loadCatalog()).filter(isShopVisible)
    return all.filter((p) => p.isFeatured).slice(0, limit)
  },

  async getBestSellers(limit = 16): Promise<StorefrontProduct[]> {
    const all = (await loadCatalog()).filter(isShopVisible)
    return all.filter((p) => p.isBestSeller).slice(0, limit)
  },

  async getLimited(limit = 6): Promise<StorefrontProduct[]> {
    const all = (await loadCatalog()).filter(isShopVisible)
    return all.filter((p) => p.isLimited).slice(0, limit)
  },

  async getRecentlyAdded(limit = 12): Promise<StorefrontProduct[]> {
    const all = (await loadCatalog()).filter(isShopVisible)
    return [...all]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit)
  },

  async getByStyle(style: StyleTag, limit = 12): Promise<StorefrontProduct[]> {
    const all = (await loadCatalog()).filter(isShopVisible)
    return all.filter((p) => p.style === style).slice(0, limit)
  },

  async getRelated(product: StorefrontProduct, limit = 4): Promise<StorefrontProduct[]> {
    const all = (await loadCatalog()).filter(isShopVisible)
    return all.filter((p) => p.id !== product.id && p.category === product.category).slice(0, limit)
  },

  async getRecentlyViewedProducts(
    ids: string[],
    excludeId: string,
    limit = 4,
  ): Promise<StorefrontProduct[]> {
    const results: StorefrontProduct[] = []
    for (const id of ids) {
      if (id === excludeId) continue
      const product = await this.getProductById(id)
      if (product) results.push(product)
      if (results.length >= limit) break
    }
    return results
  },

  async search(query: string, limit = 24): Promise<StorefrontProduct[]> {
    const { products } = await this.getShopProducts({ search: query, pageSize: limit })
    return products
  },

  async trackOrder(query: string): Promise<OrderTrackingInfo | null> {
    await delay(150)
    const q = query.trim()
    if (!q) return null

    const rows = await trackOnlineSale(q)
    if (!rows.length) return null

    const matched = rows.map((sale) => {
      const customer = sale.customers as { name?: string; phone?: string } | null
      return {
        id: sale.id,
        order_id: sale.invoice_no,
        customer_name: customer?.name ?? '',
        customer_phone: customer?.phone ?? '',
        product_name: 'Online order',
        sku: '',
        quantity: 1,
        unit_price: Number(sale.grand_total),
        cod_amount: Number(sale.due_total ?? sale.grand_total),
        status: (sale.status === 'completed' ? 'Confirmed' : 'New') as OrderStatus,
        store_id: '',
        delivery_address: '',
        delivery_area: '',
        created_at: sale.completed_at ?? new Date().toISOString(),
        updated_at: sale.completed_at ?? new Date().toISOString(),
        deleted_at: null as string | null,
      }
    })

    const primary = matched[0]
    const currentIdx = STATUS_TIMELINE.indexOf(primary.status)
    const timeline = STATUS_TIMELINE.map((status, idx) => ({
      status,
      date: idx <= currentIdx ? primary.updated_at : '',
      done: idx <= currentIdx,
    }))

    return { orders: matched as unknown as OrderTrackingInfo['orders'], timeline }
  },
}
