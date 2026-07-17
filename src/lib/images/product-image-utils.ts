import {
  deduplicateImageUrls,
  isValidImageSource,
  normalizeImageUrl,
} from './image-utils'

/** Verified files under `public/products/`; browser URLs intentionally omit `/public`. */
export const DEMO_PRODUCT_IMAGES = [
  '/products/1.png',
  '/products/2.png',
  '/products/3.png',
  '/products/4.png',
  '/products/6 (1).png',
  '/products/7.png',
  '/products/8.png',
  '/products/89.png',
] as const

export const DEFAULT_PRODUCT_IMAGE = DEMO_PRODUCT_IMAGES[0]

export interface ProductImage {
  id: string
  url: string
  alt?: string
  isCover: boolean
  sortOrder: number
}

/** Loose product shape supporting legacy image fields */
export interface ProductImageSource {
  id?: string
  productId?: string
  name?: string
  primary_image_url?: string | null
  image_url?: string | null
  primaryImageUrl?: string | null
  image?: string | null
  imageUrl?: string | null
  thumbnail?: string | null
  thumbnailUrl?: string | null
  cover?: string | null
  coverImage?: string | null
  coverImageUrl?: string | null
  hoverImage?: string | null
  gallery?: string[] | null
  images?: Array<string | ProductImage | null | undefined> | null
  alt?: string | null
}

function asUrl(value: unknown): string | null {
  return isValidImageSource(value) ? normalizeImageUrl(value) : null
}

/** Stable cross-device hash used only when a persisted image is unavailable. */
export function stableHash(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function getStableProductImageIndex(productId: string, total: number): number {
  if (total <= 0) return 0
  return stableHash(productId) % total
}

export function getStableDemoProductImage(productId?: string | null): string {
  if (!productId) return DEFAULT_PRODUCT_IMAGE
  return DEMO_PRODUCT_IMAGES[getStableProductImageIndex(productId, DEMO_PRODUCT_IMAGES.length)]
}

/**
 * Stable per-product picks from the demo pool used to pad thin galleries.
 * Seeded by product id (not Math.random) so the same product always shows the
 * same "additional" images across refreshes and devices.
 */
export function getStableAdditionalImages(
  productId: string | null | undefined,
  count: number,
  exclude: string[] = [],
): string[] {
  if (count <= 0) return []
  const pool = DEMO_PRODUCT_IMAGES.filter((url) => !exclude.includes(url))
  if (pool.length === 0) return []
  const start = productId ? getStableProductImageIndex(productId, pool.length) : 0
  return Array.from(
    { length: Math.min(count, pool.length) },
    (_, i) => pool[(start + i) % pool.length],
  )
}

export function normalizeProductImages(product: ProductImageSource): ProductImage[] {
  const images: ProductImage[] = []
  let order = 0

  const push = (url: string | null, isCover = false, alt?: string) => {
    if (!url) return
    images.push({
      id: `${product.id ?? 'p'}-img-${order}`,
      url,
      alt: alt ?? product.name ?? product.alt ?? 'Product',
      isCover,
      sortOrder: order++,
    })
  }

  const cover =
    asUrl(product.primary_image_url) ??
    asUrl(product.primaryImageUrl) ??
    asUrl(product.image_url) ??
    asUrl(product.coverImageUrl) ??
    asUrl(product.coverImage) ??
    asUrl(product.cover) ??
    asUrl(product.image) ??
    asUrl(product.imageUrl) ??
    asUrl(product.thumbnail) ??
    asUrl(product.thumbnailUrl)

  if (cover) push(cover, true)

  if (Array.isArray(product.images)) {
    for (const entry of product.images) {
      if (!entry) continue
      if (typeof entry === 'string') {
        push(asUrl(entry), false)
      } else {
        const url = asUrl(entry.url)
        if (!url) continue
        images.push({
          id: entry.id || `${product.id ?? 'p'}-img-${order}`,
          url,
          alt: entry.alt ?? product.name ?? 'Product',
          isCover: Boolean(entry.isCover),
          sortOrder: entry.sortOrder ?? order,
        })
        order++
      }
    }
  }

  if (Array.isArray(product.gallery)) {
    for (const g of product.gallery) push(asUrl(g), false)
  }

  push(asUrl(product.hoverImage), false)

  const uniqueUrls = deduplicateImageUrls(images.map((i) => i.url))
  const byUrl = new Map(images.map((i) => [i.url, i]))
  return uniqueUrls.map((url, index) => {
    const existing = byUrl.get(url)!
    return {
      ...existing,
      sortOrder: index,
      isCover: index === 0 ? true : existing.isCover && index === 0,
    }
  })
}

/**
 * Strict cover image priority:
 * 1. coverImageUrl
 * 2. isCover === true
 * 3. lowest sortOrder
 * 4. first valid image
 * 5. placeholder
 */
export function getProductCoverImage(product: ProductImageSource | null | undefined): string {
  if (!product) return DEFAULT_PRODUCT_IMAGE

  const direct =
    asUrl(product.primary_image_url) ??
    asUrl(product.primaryImageUrl) ??
    asUrl(product.image_url) ??
    asUrl(product.coverImageUrl) ??
    asUrl(product.coverImage) ??
    asUrl(product.cover)
  if (direct) return direct

  const images = normalizeProductImages(product)
  const cover = images.find((i) => i.isCover)
  if (cover) return cover.url

  const sorted = [...images].sort((a, b) => a.sortOrder - b.sortOrder)
  if (sorted[0]) return sorted[0].url

  const legacy =
    asUrl(product.image) ??
    asUrl(product.imageUrl) ??
    asUrl(product.thumbnail) ??
    asUrl(product.thumbnailUrl) ??
    asUrl(product.hoverImage)

  return legacy ?? getStableDemoProductImage(product.id ?? product.productId)
}

/** Authoritative shared resolver used by storefront, cart, checkout and POS. */
export function resolveProductImage(product: ProductImageSource | null | undefined): string {
  return getProductCoverImage(product)
}

export function getProductGalleryImages(product: ProductImageSource | null | undefined): string[] {
  if (!product) return [DEFAULT_PRODUCT_IMAGE]
  const images = normalizeProductImages(product)
  const urls = images.map((i) => i.url)
  return urls.length > 0 ? urls : [getStableDemoProductImage(product.id ?? product.productId)]
}
