import { supabase } from '@/lib/supabase/client'
import { STOREFRONT_ORG_SLUG } from '@/config/catalog'
import { resolveStorageUrl } from '@/features/products/repositories/catalog.repository'

export type CatalogVariantRow = {
  id: string
  sku: string
  barcode: string | null
  name: string | null
  selling_price: number
  purchase_price: number
  is_active: boolean
  optionValues: Array<{ option: string; value: string }>
  stockQty: number
}

export type CatalogProductRow = {
  id: string
  name: string
  description: string | null
  base_sku: string | null
  base_barcode: string | null
  selling_price: number
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
  variants: CatalogVariantRow[]
  totalStock: number
}

let cachedOrgId: string | null = null

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

type RawProduct = {
  id: string
  name: string
  description: string | null
  base_sku: string | null
  base_barcode: string | null
  selling_price: number
  purchase_price: number
  unit: string
  wholesale_price: number | null
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
  }> | null
  product_variants: Array<{
    id: string
    sku: string
    barcode: string | null
    name: string | null
    selling_price: number
    purchase_price: number
    is_active: boolean
    deleted_at: string | null
    variant_option_values: Array<{
      deleted_at: string | null
      product_options: { name: string; deleted_at: string | null } | null
      product_option_values: { value: string; deleted_at: string | null } | null
    }> | null
    inventory_balances: Array<{ quantity: number; deleted_at: string | null }> | null
  }> | null
}

const PRODUCT_SELECT = `
  id,
  name,
  description,
  base_sku,
  base_barcode,
  selling_price,
  purchase_price,
  unit,
  wholesale_price,
  has_variants,
  product_type,
  is_active,
  published_at,
  created_at,
  updated_at,
  categories(id, name, code),
  brands(id, name, code),
  subcategories(id, name),
  product_images(storage_path, is_cover, deleted_at, sort_order),
  product_variants(
    id, sku, barcode, name, selling_price, purchase_price, is_active, deleted_at,
    variant_option_values(
      deleted_at,
      product_options(name, deleted_at),
      product_option_values(value, deleted_at)
    ),
    inventory_balances(quantity, deleted_at)
  )
`

async function mapRawProduct(row: RawProduct): Promise<CatalogProductRow> {
  const images = (row.product_images ?? []).filter((i) => !i.deleted_at).sort((a, b) => {
    if (a.is_cover && !b.is_cover) return -1
    if (!a.is_cover && b.is_cover) return 1
    return a.sort_order - b.sort_order
  })
  const cover = images.find((i) => i.is_cover) ?? images[0]

  const variants = (row.product_variants ?? [])
    .filter((v) => !v.deleted_at && v.is_active)
    .map((v) => {
      const stockQty = (v.inventory_balances ?? [])
        .filter((b) => !b.deleted_at)
        .reduce((sum, b) => sum + Number(b.quantity ?? 0), 0)
      const optionValues = (v.variant_option_values ?? [])
        .filter((ov) => !ov.deleted_at)
        .map((ov) => ({
          option: ov.product_options?.name ?? 'Option',
          value: ov.product_option_values?.value ?? '',
        }))
        .filter((ov) => ov.value)
      return {
        id: v.id,
        sku: v.sku,
        barcode: v.barcode,
        name: v.name,
        selling_price: Number(v.selling_price),
        purchase_price: Number(v.purchase_price),
        is_active: v.is_active,
        optionValues,
        stockQty,
      }
    })

  const totalStock = variants.reduce((sum, v) => sum + v.stockQty, 0)

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    base_sku: row.base_sku,
    base_barcode: row.base_barcode,
    selling_price: Number(row.selling_price),
    purchase_price: Number(row.purchase_price),
    unit: row.unit,
    wholesale_price: row.wholesale_price != null ? Number(row.wholesale_price) : null,
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
    galleryPaths: images.map((i) => i.storage_path),
    variants,
    totalStock,
  }
}

export async function fetchPublishedCatalog(): Promise<CatalogProductRow[]> {
  const orgId = await resolveStorefrontOrgId()
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
  return Promise.all(((data ?? []) as unknown as RawProduct[]).map(mapRawProduct))
}

export async function fetchPublishedProductById(id: string): Promise<CatalogProductRow | null> {
  const orgId = await resolveStorefrontOrgId()
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('organization_id', orgId)
    .eq('id', id)
    .is('deleted_at', null)
    .eq('is_active', true)
    .not('published_at', 'is', null)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return mapRawProduct(data as unknown as RawProduct)
}

export async function resolveCatalogImageUrls(paths: string[]): Promise<string[]> {
  const urls = await Promise.all(paths.map((p) => resolveStorageUrl(p)))
  return urls.filter((u): u is string => Boolean(u))
}

export function invalidateStorefrontOrgCache() {
  cachedOrgId = null
}
