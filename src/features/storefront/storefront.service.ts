import type { Product } from '@/types'
import type { StorefrontCategorySlug } from '@/lib/constants'
import { getCatalogMeta, type StyleTag } from '@/lib/fashion-catalog'
import { getProductImageMeta } from '@/lib/product-images'
import { productsService } from '@/features/products/products.service'
import { ordersService } from '@/features/storefront/legacy-oms/orders.service'
import type {
  StorefrontFilters,
  StorefrontListResult,
  StorefrontProduct,
  OrderTrackingInfo,
} from './storefront.types'
import type { OrderStatus } from '@/lib/constants'
import { createProductSlug, matchesProductSlug, safeProductName } from './utils/product-slug'
import { getDisplayAlt, getDisplayGallery, getDisplayImage } from './utils/product-display'

const delay = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms))

const CATEGORY_MAP: Record<string, StorefrontCategorySlug> = {
  dress: 'dress',
  kurti: 'kurti',
  'tops-tunic': 'tops-tunic',
  'co-ord-set': 'co-ord-set',
  accessories: 'accessories',
  shoes: 'accessories',
  bags: 'accessories',
}

function slugify(name: string, sku: string): string {
  return createProductSlug(name, sku)
}

function productIndex(product: Product): number {
  const match = product.id.match(/\d+/)
  return match ? parseInt(match[0], 10) - 1 : 0
}

function safeEnrichProduct(product: Product): StorefrontProduct {
  const safeName = safeProductName(product.name)
  const safeSku = product.sku?.trim() || product.id
  const index = productIndex({ ...product, name: safeName, sku: safeSku })
  const meta = getCatalogMeta(safeSku, safeName, product.price ?? 0, index)
  const images = getProductImageMeta(safeSku, safeName, meta.category)
  const category = CATEGORY_MAP[meta.category] ?? 'new-arrival'
  const tags = [...new Set([...meta.tags, category])] as string[]
  const displayPrice = meta.onSale && meta.salePrice ? meta.salePrice : (product.price ?? 0)
  const enriched = {
    ...product,
    name: safeName,
    sku: safeSku,
    price: product.price ?? 0,
    stock: product.stock ?? 0,
    slug: slugify(safeName, safeSku),
    category,
    catalogCategory: meta.category,
    tags,
    style: meta.style,
    description: meta.description?.includes('undefined')
      ? `${safeName} — thoughtfully designed for the ${meta.style} wardrobe. Premium fabrics, refined fit, and nationwide COD delivery.`
      : meta.description,
    image: images.main,
    hoverImage: images.hover || images.main,
    gallery: images.gallery,
    alt: images.alt || safeName,
    isNew: meta.isNew,
    isTrending: meta.isTrending,
    isFeatured: meta.isFeatured,
    isBestSeller: meta.isBestSeller,
    isLimited: meta.isLimited,
    onSale: meta.onSale,
    salePrice: meta.salePrice,
    displayPrice,
    rating: meta.rating ?? 4.5,
    reviewCount: meta.reviewCount ?? 0,
  } as StorefrontProduct

  return {
    ...enriched,
    image: getDisplayImage(enriched),
    gallery: getDisplayGallery(enriched),
    alt: getDisplayAlt(enriched),
  }
}

export function enrichProduct(product: Product): StorefrontProduct {
  return safeEnrichProduct(product)
}

function isShopVisible(product: Product): boolean {
  return product.status === 'active' && product.stock > 0 && !product.deleted_at
}

function applyStorefrontFilters(products: StorefrontProduct[], filters?: StorefrontFilters): StorefrontProduct[] {
  let result = [...products]

  if (filters?.search) {
    const q = filters.search.toLowerCase()
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.style.includes(q as StyleTag),
    )
  }

  const categoryFilter = filters?.category
  if (categoryFilter && categoryFilter !== 'all') {
    result = result.filter((p) => p.tags.includes(categoryFilter))
  }

  if (filters?.style && filters.style !== 'all') {
    result = result.filter((p) => p.style === filters.style)
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

const STATUS_TIMELINE: OrderStatus[] = ['New', 'Confirmed', 'Packed', 'Courier Booked', 'Shipped', 'Delivered']

let cachedShopProducts: StorefrontProduct[] | null = null
let cachedCatalogProducts: StorefrontProduct[] | null = null

async function getAllCatalogProducts(): Promise<StorefrontProduct[]> {
  if (cachedCatalogProducts) return cachedCatalogProducts
  const all = (await productsService.getProducts())
    .filter((p) => !p.deleted_at && p.status !== 'inactive')
    .map(enrichProduct)
  cachedCatalogProducts = all
  return all
}

async function getAllShopProducts(): Promise<StorefrontProduct[]> {
  if (cachedShopProducts) return cachedShopProducts
  const all = (await productsService.getProducts({ status: 'active' }))
    .filter(isShopVisible)
    .map(enrichProduct)
  cachedShopProducts = all
  return all
}

export function invalidateStorefrontCache() {
  cachedShopProducts = null
  cachedCatalogProducts = null
}

export const storefrontService = {
  async getShopProducts(filters?: StorefrontFilters): Promise<StorefrontListResult> {
    await delay()
    const all = await getAllShopProducts()
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
    await delay(80)
    const trimmed = slug?.trim()
    if (!trimmed) return null

    const all = await getAllCatalogProducts()
    const direct = all.find((p) => p.slug === trimmed || matchesProductSlug(p.slug, trimmed))
    if (direct) return direct

    const byId = all.find((p) => p.id === trimmed)
    if (byId) return byId

    const product = await productsService.getProductById(trimmed)
    if (!product || product.deleted_at || product.status === 'inactive') return null
    return enrichProduct(product)
  },

  async getProductById(id: string): Promise<StorefrontProduct | null> {
    await delay(80)
    const product = await productsService.getProductById(id)
    if (!product || product.deleted_at || product.status === 'inactive') return null
    return enrichProduct(product)
  },

  async getNewArrivals(limit = 12): Promise<StorefrontProduct[]> {
    const all = await getAllShopProducts()
    return all.filter((p) => p.isNew).slice(0, limit)
  },

  async getTrending(limit = 12): Promise<StorefrontProduct[]> {
    const all = await getAllShopProducts()
    return all.filter((p) => p.isTrending).slice(0, limit)
  },

  async getFeatured(limit = 8): Promise<StorefrontProduct[]> {
    const all = await getAllShopProducts()
    return all.filter((p) => p.isFeatured).slice(0, limit)
  },

  async getBestSellers(limit = 16): Promise<StorefrontProduct[]> {
    const all = await getAllShopProducts()
    return all.filter((p) => p.isBestSeller).slice(0, limit)
  },

  async getLimited(limit = 6): Promise<StorefrontProduct[]> {
    const all = await getAllShopProducts()
    return all.filter((p) => p.isLimited).slice(0, limit)
  },

  async getRecentlyAdded(limit = 12): Promise<StorefrontProduct[]> {
    const all = await getAllShopProducts()
    return [...all].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, limit)
  },

  async getByStyle(style: StyleTag, limit = 12): Promise<StorefrontProduct[]> {
    const all = await getAllShopProducts()
    return all.filter((p) => p.style === style).slice(0, limit)
  },

  async getRelated(product: StorefrontProduct, limit = 4): Promise<StorefrontProduct[]> {
    const all = await getAllShopProducts()
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
    const orders = await ordersService.getOrders({ search: q })
    const matched = orders.filter(
      (o) =>
        !o.deleted_at &&
        (o.order_id.toLowerCase() === q.toLowerCase() ||
          o.customer_phone.includes(q) ||
          o.order_id.toLowerCase().includes(q.toLowerCase())),
    )
    if (matched.length === 0) return null
    const primary = matched[0]
    const currentIdx = STATUS_TIMELINE.indexOf(primary.status)
    const timeline = STATUS_TIMELINE.map((status, idx) => ({
      status,
      date: idx <= currentIdx ? primary.updated_at : '',
      done: idx <= currentIdx,
    }))
    if (primary.status === 'Returned' || primary.status === 'Cancelled') {
      timeline.push({ status: primary.status, date: primary.updated_at, done: true })
    }
    return { orders: matched, timeline }
  },
}
