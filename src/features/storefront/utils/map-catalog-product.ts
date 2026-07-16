import type { StorefrontCategorySlug } from '@/lib/constants'
import { ECOMMERCE_STORE_ID, ECOMMERCE_STORE_NAME } from '@/lib/constants'
import { getProductImageMeta } from '@/lib/product-images'
import type { CatalogProductRow } from '../repositories/storefront-catalog.repository'
import { resolveCatalogImageUrls } from '../repositories/storefront-catalog.repository'
import type { StorefrontProduct } from '../storefront.types'
import { createProductSlug } from './product-slug'

const CATEGORY_SLUG_MAP: Record<string, StorefrontCategorySlug> = {
  dress: 'dress',
  dresses: 'dress',
  kurti: 'kurti',
  kurtis: 'kurti',
  'tops-tunic': 'tops-tunic',
  tops: 'tops-tunic',
  tunic: 'tops-tunic',
  'co-ord-set': 'co-ord-set',
  coord: 'co-ord-set',
  accessories: 'accessories',
  cosmetic: 'accessories',
  cosmetics: 'accessories',
  shoes: 'accessories',
  bags: 'accessories',
  'new-arrival': 'new-arrival',
}

function resolveCategorySlug(row: CatalogProductRow): StorefrontCategorySlug {
  const code = row.category?.code?.toLowerCase()
  const name = row.category?.name?.toLowerCase()
  if (code && CATEGORY_SLUG_MAP[code]) return CATEGORY_SLUG_MAP[code]
  if (name) {
    for (const [key, slug] of Object.entries(CATEGORY_SLUG_MAP)) {
      if (name.includes(key)) return slug
    }
  }
  return 'new-arrival'
}

function buildVariantOptions(row: CatalogProductRow) {
  const sizes = new Set<string>()
  const colors = new Set<string>()
  for (const v of row.variants) {
    for (const ov of v.optionValues) {
      const opt = ov.option.toLowerCase()
      if (opt.includes('size') || opt.includes('volume')) sizes.add(ov.value)
      if (opt.includes('color') || opt.includes('shade')) colors.add(ov.value)
    }
  }
  return {
    sizes: [...sizes],
    colors: [...colors],
    variants: row.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      label: v.name ?? v.sku,
      sellingPrice: v.selling_price,
      stock: v.stockQty,
      optionValues: v.optionValues,
    })),
  }
}

export async function mapCatalogToStorefront(row: CatalogProductRow): Promise<StorefrontProduct> {
  const sku = row.base_sku ?? row.variants[0]?.sku ?? row.id.slice(0, 8)
  const slug = createProductSlug(row.name, sku)
  const category = resolveCategorySlug(row)
  const stock = row.totalStock
  const sellingPrice = row.has_variants
    ? row.variants[0]?.selling_price ?? row.selling_price
    : row.selling_price

  let imageUrls = await resolveCatalogImageUrls(
    row.galleryPaths.length ? row.galleryPaths : row.coverPath ? [row.coverPath] : [],
  )

  if (imageUrls.length === 0) {
    const imageCategory =
      category === 'dress' ||
      category === 'kurti' ||
      category === 'tops-tunic' ||
      category === 'co-ord-set' ||
      category === 'accessories'
        ? category
        : 'dress'
    const fallback = getProductImageMeta(sku, row.name, imageCategory)
    imageUrls = [fallback.main, ...fallback.gallery.filter((g) => g !== fallback.main)]
  }

  const variantMeta = buildVariantOptions(row)
  const createdAt = row.created_at
  const isRecent = Date.now() - new Date(createdAt).getTime() < 1000 * 60 * 60 * 24 * 30

  return {
    id: row.id,
    name: row.name,
    sku,
    price: sellingPrice,
    stock,
    store_id: ECOMMERCE_STORE_ID,
    store_name: ECOMMERCE_STORE_NAME,
    status: stock > 0 ? 'active' : 'out_of_stock',
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: null,
    slug,
    category,
    catalogCategory: row.category?.name?.toLowerCase() ?? category,
    tags: [category, row.brand?.name ?? ''].filter(Boolean),
    style: 'casual' as const,
    description:
      row.description ??
      `${row.name} — premium quality with nationwide cash on delivery.`,
    image: imageUrls[0] ?? '',
    hoverImage: imageUrls[1] ?? imageUrls[0] ?? '',
    gallery: imageUrls,
    alt: row.name,
    isNew: isRecent,
    isTrending: stock > 0 && isRecent,
    isFeatured: row.published_at != null && stock > 5,
    isBestSeller: stock > 20,
    isLimited: false,
    onSale: false,
    displayPrice: sellingPrice,
    rating: 0,
    reviewCount: 0,
    catalogVariants: variantMeta.variants,
    catalogSizes: variantMeta.sizes,
    catalogColors: variantMeta.colors,
    hasVariants: row.has_variants,
  }
}
