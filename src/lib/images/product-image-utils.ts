import {
  deduplicateImageUrls,
  getFallbackImage,
  isValidImageSource,
  normalizeImageUrl,
} from './image-utils'

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
  name?: string
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
  if (!product) return getFallbackImage()

  const direct =
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

  return legacy ?? getFallbackImage()
}

export function getProductGalleryImages(product: ProductImageSource | null | undefined): string[] {
  if (!product) return [getFallbackImage()]
  const images = normalizeProductImages(product)
  const urls = images.map((i) => i.url)
  return urls.length > 0 ? urls : [getFallbackImage()]
}
