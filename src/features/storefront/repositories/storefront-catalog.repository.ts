import { supabase } from '@/lib/supabase/client'
import { STOREFRONT_ORG_SLUG } from '@/config/catalog'
import { resolveStorageUrl } from '@/features/products/repositories/catalog.repository'
import {
  buildBranchPriceIndex,
  resolvePriceFromIndex,
  type BranchPriceIndex,
  type BranchPriceRow,
} from '@/features/products/lib/resolve-branch-price'

export type CatalogVariantRow = {
  id: string
  sku: string
  barcode: string | null
  name: string | null
  selling_price: number
  /** Always 0 on public catalog — cost never exposed to anon. */
  purchase_price: number
  is_active: boolean
  imagePath: string | null
  optionValues: Array<{ option: string; value: string }>
  stockQty: number
  inStock: boolean
}

export type CatalogProductRow = {
  id: string
  name: string
  description: string | null
  base_sku: string | null
  base_barcode: string | null
  selling_price: number
  /** Always 0 on public catalog — cost never exposed to anon. */
  purchase_price: number
  unit: string
  wholesale_price: number | null
  has_variants: boolean
  product_type: string
  is_active: boolean
  published_at: string | null
  created_at: string
  updated_at: string
  category: { id: string; name: string; code: string | null } | null
  brand: { id: string; name: string; code: string | null } | null
  subcategory: { id: string; name: string } | null
  coverPath: string | null
  galleryPaths: string[]
  /** Product-level images only (variant_id is null) */
  productImagePaths: string[]
  variants: CatalogVariantRow[]
  totalStock: number
  fulfillmentBranchId: string | null
}

let cachedOrgId: string | null = null
let cachedFulfillment: {
  orgId: string
  branchId: string | null
  locationIds: string[]
  priceIndex: BranchPriceIndex
} | null = null

export async function resolveStorefrontOrgId(): Promise<string> {
  if (cachedOrgId) return cachedOrgId
  const { data, error } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', STOREFRONT_ORG_SLUG)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  if (!data?.id) throw new Error(`Storefront organization "${STOREFRONT_ORG_SLUG}" not found`)
  cachedOrgId = data.id
  return data.id
}

export async function resolveStorefrontFulfillmentContext(orgId?: string): Promise<{
  branchId: string | null
  locationIds: string[]
  priceIndex: BranchPriceIndex
}> {
  const resolvedOrgId = orgId ?? (await resolveStorefrontOrgId())
  if (cachedFulfillment?.orgId === resolvedOrgId) {
    return {
      branchId: cachedFulfillment.branchId,
      locationIds: cachedFulfillment.locationIds,
      priceIndex: cachedFulfillment.priceIndex,
    }
  }

  const { data, error } = await supabase.rpc('get_storefront_fulfillment_context', {
    p_org_id: resolvedOrgId,
  })
  if (error) throw error

  const payload = (data ?? {}) as {
    branch_id?: string | null
    saleable_location_ids?: string[]
    prices?: Array<{
      product_id: string
      variant_id: string | null
      retail_price: number | null
      discount_price: number | null
      effective_from: string
      effective_to: string | null
    }>
  }

  const priceRows: BranchPriceRow[] = (payload.prices ?? []).map((p) => ({
    product_id: p.product_id,
    variant_id: p.variant_id,
    retail_price: p.retail_price,
    discount_price: p.discount_price,
    wholesale_price: null,
    effective_from: p.effective_from,
    effective_to: p.effective_to,
  }))

  const ctx = {
    orgId: resolvedOrgId,
    branchId: payload.branch_id ?? null,
    locationIds: payload.saleable_location_ids ?? [],
    priceIndex: buildBranchPriceIndex(priceRows),
  }
  cachedFulfillment = ctx
  return {
    branchId: ctx.branchId,
    locationIds: ctx.locationIds,
    priceIndex: ctx.priceIndex,
  }
}

type RawProduct = {
  id: string
  name: string
  description: string | null
  base_sku: string | null
  base_barcode: string | null
  selling_price: number
  unit: string
  has_variants: boolean
  product_type: string
  is_active: boolean
  published_at: string | null
  created_at: string
  updated_at: string
  categories: { id: string; name: string; code: string | null } | null
  brands: { id: string; name: string; code: string | null } | null
  subcategories: { id: string; name: string } | null
  product_images: Array<{
    storage_path: string
    is_cover: boolean
    deleted_at: string | null
    sort_order: number
    variant_id: string | null
  }> | null
  product_variants: Array<{
    id: string
    sku: string
    barcode: string | null
    name: string | null
    selling_price: number
    is_active: boolean
    deleted_at: string | null
    image_path: string | null
    variant_option_values: Array<{
      deleted_at: string | null
      product_options: { name: string; deleted_at: string | null } | null
      product_option_values: { value: string; deleted_at: string | null } | null
    }> | null
    inventory_balances: Array<{
      quantity: number
      qty_reserved?: number
      location_id?: string | null
      deleted_at: string | null
    }> | null
  }> | null
}

const PRODUCT_SELECT = `
  id,
  name,
  description,
  base_sku,
  base_barcode,
  selling_price,
  unit,
  has_variants,
  product_type,
  is_active,
  published_at,
  created_at,
  updated_at,
  categories(id, name, code),
  brands(id, name, code),
  subcategories(id, name),
  product_images(storage_path, is_cover, deleted_at, sort_order, variant_id),
  product_variants(
    id, sku, barcode, name, selling_price, is_active, deleted_at, image_path,
    variant_option_values(
      deleted_at,
      product_options(name, deleted_at),
      product_option_values(value, deleted_at)
    ),
    inventory_balances(quantity, qty_reserved, location_id, deleted_at)
  )
`

async function mapRawProduct(
  row: RawProduct,
  fulfillment: {
    branchId: string | null
    locationIds: string[]
    priceIndex: BranchPriceIndex
  },
): Promise<CatalogProductRow> {
  const allImages = (row.product_images ?? []).filter((i) => !i.deleted_at).sort((a, b) => {
    if (a.is_cover && !b.is_cover) return -1
    if (!a.is_cover && b.is_cover) return 1
    return a.sort_order - b.sort_order
  })
  const productImages = allImages.filter((i) => !i.variant_id)
  const imagesByVariant = new Map<string, string>()
  for (const image of allImages) {
    if (!image.variant_id) continue
    if (!imagesByVariant.has(image.variant_id)) {
      imagesByVariant.set(image.variant_id, image.storage_path)
    }
  }
  const cover = productImages.find((i) => i.is_cover) ?? productImages[0] ?? allImages[0]

  const locationSet = new Set(fulfillment.locationIds)
  const canClaimStock = Boolean(fulfillment.branchId && locationSet.size > 0)

  const variants = (row.product_variants ?? [])
    .filter((v) => !v.deleted_at && v.is_active)
    .map((v) => {
      const stockQty = canClaimStock
        ? (v.inventory_balances ?? [])
            .filter(
              (b) =>
                !b.deleted_at &&
                b.location_id != null &&
                locationSet.has(b.location_id),
            )
            .reduce((sum, b) => {
              const available =
                Number(b.quantity ?? 0) - Number(b.qty_reserved ?? 0)
              return sum + Math.max(available, 0)
            }, 0)
        : 0
      const optionValues = (v.variant_option_values ?? [])
        .filter((ov) => !ov.deleted_at)
        .map((ov) => ({
          option: ov.product_options?.name ?? 'Option',
          value: ov.product_option_values?.value ?? '',
        }))
        .filter((ov) => ov.value)
      const selling_price = resolvePriceFromIndex(fulfillment.priceIndex, {
        productId: row.id,
        variantId: v.id,
        variantSellingPrice: Number(v.selling_price),
        productSellingPrice: Number(row.selling_price),
      })
      return {
        id: v.id,
        sku: v.sku,
        barcode: v.barcode,
        name: v.name,
        selling_price,
        purchase_price: 0,
        is_active: v.is_active,
        imagePath: v.image_path ?? imagesByVariant.get(v.id) ?? null,
        optionValues,
        stockQty,
        inStock: stockQty > 0,
      }
    })

  const totalStock = variants.reduce((sum, v) => sum + v.stockQty, 0)
  const productImagePaths = productImages.map((i) => i.storage_path)
  const productPrice =
    variants.length > 0
      ? Math.min(...variants.map((v) => v.selling_price))
      : Number(row.selling_price)

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    base_sku: row.base_sku,
    base_barcode: row.base_barcode,
    selling_price: productPrice,
    purchase_price: 0,
    unit: row.unit,
    wholesale_price: null,
    has_variants: row.has_variants,
    product_type: row.product_type,
    is_active: row.is_active,
    published_at: row.published_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    category: row.categories,
    brand: row.brands,
    subcategory: row.subcategories,
    coverPath: cover?.storage_path ?? null,
    galleryPaths: productImagePaths.length
      ? productImagePaths
      : cover?.storage_path
        ? [cover.storage_path]
        : [],
    productImagePaths,
    variants,
    totalStock,
    fulfillmentBranchId: fulfillment.branchId,
  }
}

export async function fetchPublishedCatalog(): Promise<CatalogProductRow[]> {
  const orgId = await resolveStorefrontOrgId()
  const fulfillment = await resolveStorefrontFulfillmentContext(orgId)
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .eq('is_active', true)
    .eq('status' as never, 'active')
    .not('published_at', 'is', null)
    .order('created_at', { ascending: false })

  if (error) throw error
  return Promise.all(
    ((data ?? []) as unknown as RawProduct[]).map((row) => mapRawProduct(row, fulfillment)),
  )
}

export async function fetchPublishedProductById(id: string): Promise<CatalogProductRow | null> {
  const orgId = await resolveStorefrontOrgId()
  const fulfillment = await resolveStorefrontFulfillmentContext(orgId)
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('organization_id', orgId)
    .eq('id', id)
    .is('deleted_at', null)
    .eq('is_active', true)
    .eq('status' as never, 'active')
    .not('published_at', 'is', null)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return mapRawProduct(data as unknown as RawProduct, fulfillment)
}

export async function resolveCatalogImageUrls(paths: string[]): Promise<string[]> {
  const urls = await Promise.all(paths.map((p) => resolveStorageUrl(p)))
  return urls.filter((u): u is string => Boolean(u))
}

export function invalidateStorefrontOrgCache() {
  cachedOrgId = null
  cachedFulfillment = null
}
