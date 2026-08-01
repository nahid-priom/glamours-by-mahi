import { supabase } from '@/lib/supabase/client'
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database'
import type { EntityOption } from '@/components/entity-combobox'

/** Untyped access for tables/RPCs pending database.ts regeneration. */
type UntypedRpc = (fn: string, args?: object) => Promise<{ data: unknown; error: { message: string } | null }>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const untypedFrom = ((table: string) => (supabase as any).from(table)) as (table: string) => any
const untypedRpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc

export type Category = Tables<'categories'>
export type Subcategory = Tables<'subcategories'>
export type Brand = Tables<'brands'>
export type Product = Tables<'products'>
export type ProductVariant = Tables<'product_variants'>
export type ProductImage = Tables<'product_images'>

export type ProductLifecycleStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'active'
  | 'inactive'
  | 'rejected'
  | 'archived'

export type ProductStockStatus =
  | 'low_stock'
  | 'out_of_stock'
  | 'expiring_soon'

export type ProductListSort =
  | 'recently_added'
  | 'name_asc'
  | 'stock_desc'
  | 'stock_asc'
  | 'value_desc'
  | 'value_asc'

export type PageParams = {
  search?: string
  page?: number
  pageSize?: number
  categoryId?: string | null
  brandId?: string | null
  activeOnly?: boolean
  productId?: string | null
  status?: ProductLifecycleStatus | null
  stockStatus?: ProductStockStatus | null
  sort?: ProductListSort
}

export type PagedResult<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
}

const BUCKET = 'product-images'

export async function resolveStorageUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null
  // Root-relative paths point to Vite/public assets, not Supabase Storage.
  if (path.startsWith('/')) return path
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:')) {
    return path
  }
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60)
  if (error || !data?.signedUrl) {
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return pub.publicUrl || null
  }
  return data.signedUrl
}

function range(page: number, pageSize: number) {
  const from = (page - 1) * pageSize
  return { from, to: from + pageSize - 1 }
}

/* ── Categories ─────────────────────────────────────────────── */

export async function listCategories(params: PageParams = {}): Promise<PagedResult<Category>> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 50
  const { from, to } = range(page, pageSize)
  let q = supabase
    .from('categories')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
    .range(from, to)

  if (params.search?.trim()) {
    const s = params.search.trim()
    q = q.or(`name.ilike.%${s}%,code.ilike.%${s}%`)
  }
  if (params.activeOnly) q = q.eq('is_active', true)

  const { data, error, count } = await q
  if (error) throw error
  return { items: data ?? [], total: count ?? 0, page, pageSize }
}

export async function searchCategories(query: string): Promise<EntityOption[]> {
  const { items } = await listCategories({ search: query, pageSize: 20, activeOnly: true })
  return items.map((c) => ({ id: c.id, label: c.name, description: c.code ?? undefined }))
}

export type CategoryProductCount = {
  categoryId: string
  categoryName: string
  productCount: number
}

export async function getCategoryProductCounts(): Promise<{
  total: number
  uncategorized: number
  categories: CategoryProductCount[]
}> {
  const { data, error } = await supabase
    .from('products')
    .select('id, category_id, categories(id, name)')
    .is('deleted_at', null)

  if (error) throw error

  const rows = (data ?? []) as Array<{
    id: string
    category_id: string | null
    categories: { id: string; name: string } | null
  }>

  let uncategorized = 0
  const counts = new Map<string, CategoryProductCount>()

  for (const row of rows) {
    if (!row.category_id) {
      uncategorized += 1
      continue
    }
    const existing = counts.get(row.category_id)
    if (existing) {
      existing.productCount += 1
    } else {
      counts.set(row.category_id, {
        categoryId: row.category_id,
        categoryName: row.categories?.name ?? 'Category',
        productCount: 1,
      })
    }
  }

  const categories = [...counts.values()].sort((a, b) =>
    a.categoryName.localeCompare(b.categoryName, undefined, { sensitivity: 'base' }),
  )

  return { total: rows.length, uncategorized, categories }
}

export async function createCategory(
  orgId: string,
  input: Pick<TablesInsert<'categories'>, 'name' | 'code' | 'description' | 'sort_order' | 'is_active'>,
) {
  const { data, error } = await supabase
    .from('categories')
    .insert({ ...input, organization_id: orgId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCategory(id: string, input: TablesUpdate<'categories'>) {
  const { data, error } = await supabase
    .from('categories')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function softDeleteCategory(id: string) {
  const { error } = await supabase
    .from('categories')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', id)
  if (error) throw error
}

/* ── Subcategories ──────────────────────────────────────────── */

export type SubcategoryRow = Subcategory & { categories?: { id: string; name: string } | null }

export async function listSubcategories(
  params: PageParams = {},
): Promise<PagedResult<SubcategoryRow>> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 50
  const { from, to } = range(page, pageSize)
  let q = supabase
    .from('subcategories')
    .select('*, categories!inner(id, name)', { count: 'exact' })
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
    .range(from, to)

  if (params.categoryId === '__uncategorized__') {
    q = q.is('category_id', null)
  } else if (params.categoryId) {
    q = q.eq('category_id', params.categoryId)
  }
  if (params.search?.trim()) {
    const s = params.search.trim()
    q = q.or(`name.ilike.%${s}%,code.ilike.%${s}%`)
  }
  if (params.activeOnly) q = q.eq('is_active', true)

  const { data, error, count } = await q
  if (error) throw error
  return { items: (data ?? []) as unknown as SubcategoryRow[], total: count ?? 0, page, pageSize }
}

export async function searchSubcategories(
  query: string,
  categoryId?: string | null,
): Promise<EntityOption[]> {
  const { items } = await listSubcategories({
    search: query,
    pageSize: 20,
    activeOnly: true,
    categoryId,
  })
  return items.map((c) => ({
    id: c.id,
    label: c.name,
    description: c.categories?.name,
  }))
}

export async function createSubcategory(
  orgId: string,
  input: Pick<
    TablesInsert<'subcategories'>,
    'category_id' | 'name' | 'code' | 'description' | 'sort_order' | 'is_active'
  >,
) {
  const { data, error } = await supabase
    .from('subcategories')
    .insert({ ...input, organization_id: orgId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateSubcategory(id: string, input: TablesUpdate<'subcategories'>) {
  const { data, error } = await supabase
    .from('subcategories')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function softDeleteSubcategory(id: string) {
  const { error } = await supabase
    .from('subcategories')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', id)
  if (error) throw error
}

/* ── Brands ─────────────────────────────────────────────────── */

export async function listBrands(params: PageParams = {}): Promise<PagedResult<Brand>> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 50
  const { from, to } = range(page, pageSize)
  let q = supabase
    .from('brands')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .range(from, to)

  if (params.search?.trim()) {
    const s = params.search.trim()
    q = q.or(`name.ilike.%${s}%,code.ilike.%${s}%`)
  }
  if (params.activeOnly) q = q.eq('is_active', true)

  const { data, error, count } = await q
  if (error) throw error
  return { items: data ?? [], total: count ?? 0, page, pageSize }
}

export async function searchBrands(query: string): Promise<EntityOption[]> {
  const { items } = await listBrands({ search: query, pageSize: 20, activeOnly: true })
  return items.map((b) => ({ id: b.id, label: b.name, description: b.code ?? undefined }))
}

export async function createBrand(
  orgId: string,
  input: Pick<TablesInsert<'brands'>, 'name' | 'code' | 'description' | 'is_active'>,
) {
  const { data, error } = await supabase
    .from('brands')
    .insert({ ...input, organization_id: orgId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateBrand(id: string, input: TablesUpdate<'brands'>) {
  const { data, error } = await supabase.from('brands').update(input).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function softDeleteBrand(id: string) {
  const { error } = await supabase
    .from('brands')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', id)
  if (error) throw error
}

/* ── Products ───────────────────────────────────────────────── */

export type ProductListItem = Product & {
  status?: ProductLifecycleStatus | string
  categories?: { id: string; name: string } | null
  brands?: { id: string; name: string } | null
  subcategories?: { id: string; name: string } | null
  product_images?: Array<{ storage_path: string; is_cover: boolean; deleted_at: string | null }>
  product_variants?: Array<{
    id: string
    sku?: string
    barcode?: string | null
    name?: string | null
    selling_price?: number
    deleted_at: string | null
    inventory_balances?: Array<{ quantity: number; deleted_at: string | null }>
  }>
  coverUrl?: string | null
  variantCount?: number
  totalStock?: number
}

export type BranchProductPrice = {
  id: string
  branch_id: string
  product_id: string
  variant_id: string | null
  retail_price: number | null
  wholesale_price: number | null
  discount_price: number | null
  is_active: boolean
}

export type ExpiryAlertRow = {
  id: string
  product_id: string
  variant_id: string
  batch_id: string
  severity: string
  expires_at: string
  quantity_available: number
  message: string
  is_read: boolean
  product_name?: string | null
  variant_name?: string | null
  retail_hint?: number | null
}

export type ProductAuditEntry = {
  id: string
  action: string
  reason: string | null
  after_data: unknown
  before_data: unknown
  created_at: string
  actor_id: string | null
}

export async function listProducts(params: PageParams = {}): Promise<PagedResult<ProductListItem>> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 24
  const stockFilter = params.stockStatus
  const useMemoryPaging = Boolean(stockFilter)
  const fetchPage = useMemoryPaging ? 1 : page
  const fetchSize = useMemoryPaging ? 500 : pageSize
  const { from, to } = range(fetchPage, fetchSize)

  let expiringProductIds: Set<string> | null = null
  if (stockFilter === 'expiring_soon') {
    const { data: alerts } = await untypedFrom('expiry_alerts')
      .select('product_id')
      .eq('is_read', false)
      .limit(500)
    expiringProductIds = new Set((alerts ?? []).map((a: { product_id: string }) => a.product_id))
  }

  let q = supabase
    .from('products')
    .select(
      `
      *,
      categories(id, name),
      brands(id, name),
      subcategories(id, name),
      product_images(storage_path, is_cover, deleted_at),
      product_variants(id, sku, barcode, name, selling_price, deleted_at, inventory_balances(quantity, deleted_at))
    `,
      { count: useMemoryPaging ? undefined : 'exact' },
    )
    .is('deleted_at', null)

  if (params.sort === 'recently_added') {
    q = q.order('created_at', { ascending: false })
  } else {
    q = q.order('name', { ascending: true })
  }

  q = q.range(from, to)

  if (params.search?.trim()) {
    const s = params.search.trim()
    q = q.or(`name.ilike.%${s}%,base_sku.ilike.%${s}%,base_barcode.ilike.%${s}%`)
  }
  if (params.categoryId === '__uncategorized__') {
    q = q.is('category_id', null)
  } else if (params.categoryId) {
    q = q.eq('category_id', params.categoryId)
  }
  if (params.brandId) q = q.eq('brand_id', params.brandId)
  if (params.activeOnly) q = q.eq('is_active', true)
  if (params.status) q = q.eq('status' as never, params.status)

  const { data, error, count } = await q
  if (error) throw error

  let items = await Promise.all(
    ((data ?? []) as unknown as ProductListItem[]).map(async (p) => {
      const images = (p.product_images ?? []).filter((i) => !i.deleted_at)
      const cover = images.find((i) => i.is_cover) ?? images[0]
      const variants = (p.product_variants ?? []).filter((v) => !v.deleted_at)
      const totalStock = variants.reduce((sum, v) => {
        const qty = (v.inventory_balances ?? [])
          .filter((b) => !b.deleted_at)
          .reduce((s, b) => s + Number(b.quantity ?? 0), 0)
        return sum + qty
      }, 0)
      return {
        ...p,
        coverUrl: await resolveStorageUrl(cover?.storage_path),
        variantCount: variants.length,
        totalStock,
      }
    }),
  )

  if (stockFilter === 'low_stock') {
    items = items.filter(
      (p) => (p.totalStock ?? 0) > 0 && (p.totalStock ?? 0) <= Number(p.reorder_level ?? 0),
    )
  } else if (stockFilter === 'out_of_stock') {
    items = items.filter((p) => (p.totalStock ?? 0) <= 0)
  } else if (stockFilter === 'expiring_soon' && expiringProductIds) {
    items = items.filter((p) => expiringProductIds!.has(p.id))
  }

  if (useMemoryPaging) {
    const total = items.length
    const sliceFrom = (page - 1) * pageSize
    items = items.slice(sliceFrom, sliceFrom + pageSize)
    return { items, total, page, pageSize }
  }

  return { items, total: count ?? 0, page, pageSize }
}

export async function getProduct(id: string): Promise<ProductListItem | null> {
  const { data, error } = await supabase
    .from('products')
    .select(
      `
      *,
      categories(id, name),
      brands(id, name),
      subcategories(id, name),
      product_images(id, storage_path, is_cover, deleted_at, sort_order)
    `,
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const row = data as unknown as ProductListItem
  const images = (row.product_images ?? []).filter((i) => !i.deleted_at)
  const cover = images.find((i) => i.is_cover) ?? images[0]
  return { ...row, coverUrl: await resolveStorageUrl(cover?.storage_path) }
}

export async function searchProducts(query: string): Promise<EntityOption[]> {
  const { items } = await listProducts({ search: query, pageSize: 20, activeOnly: true })
  return items.map((p) => ({
    id: p.id,
    label: p.name,
    description: p.base_sku ?? undefined,
  }))
}

export type ProductInput = {
  name: string
  description?: string | null
  category_id?: string | null
  subcategory_id?: string | null
  brand_id?: string | null
  product_type?: Product['product_type']
  unit?: string
  base_sku?: string | null
  base_barcode?: string | null
  purchase_price?: number
  selling_price?: number
  wholesale_price?: number | null
  reorder_level?: number
  tax_rate?: number
  is_active?: boolean
  track_inventory?: boolean
  has_variants?: boolean
  publish?: boolean
}

export type VariantMatrixSaveInput = {
  sizes: string[]
  colors: string[]
  variants: Array<{
    size: string
    color: string
    sku: string
    barcode?: string | null
    name: string
    purchase_price: number
    selling_price: number
    wholesale_price?: number | null
    is_active?: boolean
  }>
  sizeOptionName?: string
  colorOptionName?: string
}

export async function createProduct(orgId: string, input: ProductInput) {
  if (input.has_variants && input.is_active !== false) {
    throw new Error('Variable products must be saved with at least one variant. Use createProductWithMatrix.')
  }

  const publishedAt =
    input.publish && input.is_active !== false ? new Date().toISOString() : null

  const { data, error } = await supabase
    .from('products')
    .insert({
      organization_id: orgId,
      name: input.name,
      description: input.description ?? null,
      category_id: input.category_id ?? null,
      subcategory_id: input.subcategory_id ?? null,
      brand_id: input.brand_id ?? null,
      product_type: input.product_type ?? 'simple',
      unit: input.unit ?? 'pcs',
      base_sku: input.base_sku ?? null,
      base_barcode: input.base_barcode ?? null,
      purchase_price: input.purchase_price ?? 0,
      selling_price: input.selling_price ?? 0,
      wholesale_price: input.wholesale_price ?? null,
      reorder_level: input.reorder_level ?? 0,
      tax_rate: input.tax_rate ?? 0,
      is_active: input.is_active ?? true,
      track_inventory: input.track_inventory ?? true,
      has_variants: input.has_variants ?? false,
      published_at: publishedAt,
    })
    .select()
    .single()
  if (error) throw error

  // Ensure a default variant for simple products
  if (!input.has_variants) {
    const sku = input.base_sku || `SKU-${data.id.slice(0, 8).toUpperCase()}`
    const { error: vErr } = await supabase.from('product_variants').insert({
      organization_id: orgId,
      product_id: data.id,
      sku,
      barcode: input.base_barcode ?? null,
      name: 'Default',
      purchase_price: input.purchase_price ?? 0,
      selling_price: input.selling_price ?? 0,
      wholesale_price: input.wholesale_price ?? null,
      is_active: true,
    })
    if (vErr) throw vErr
  }

  return data
}

export async function createProductWithMatrix(
  orgId: string,
  input: ProductInput,
  matrix: VariantMatrixSaveInput,
) {
  if (!matrix.variants.length) {
    throw new Error('Select at least one size and color to create variants.')
  }

  const publishedAt =
    input.publish && input.is_active !== false ? new Date().toISOString() : null

  const { data: product, error: pErr } = await supabase
    .from('products')
    .insert({
      organization_id: orgId,
      name: input.name,
      description: input.description ?? null,
      category_id: input.category_id ?? null,
      subcategory_id: input.subcategory_id ?? null,
      brand_id: input.brand_id ?? null,
      product_type: input.product_type ?? 'variable',
      unit: input.unit ?? 'pcs',
      base_sku: input.base_sku ?? null,
      base_barcode: input.base_barcode ?? null,
      purchase_price: input.purchase_price ?? 0,
      selling_price: input.selling_price ?? 0,
      wholesale_price: input.wholesale_price ?? null,
      reorder_level: input.reorder_level ?? 0,
      tax_rate: input.tax_rate ?? 0,
      is_active: input.is_active ?? true,
      track_inventory: input.track_inventory ?? true,
      has_variants: true,
      published_at: publishedAt,
    })
    .select()
    .single()
  if (pErr) throw pErr

  const sizeOptionName = matrix.sizeOptionName ?? 'Size'
  const colorOptionName = matrix.colorOptionName ?? 'Color'

  const { data: sizeOpt, error: soErr } = await supabase
    .from('product_options')
    .insert({
      organization_id: orgId,
      product_id: product.id,
      name: sizeOptionName,
      sort_order: 0,
    })
    .select()
    .single()
  if (soErr) throw soErr

  const { data: colorOpt, error: coErr } = await supabase
    .from('product_options')
    .insert({
      organization_id: orgId,
      product_id: product.id,
      name: colorOptionName,
      sort_order: 1,
    })
    .select()
    .single()
  if (coErr) throw coErr

  const sizeValueMap = new Map<string, string>()
  for (const size of matrix.sizes) {
    const { data: val, error } = await supabase
      .from('product_option_values')
      .insert({ organization_id: orgId, option_id: sizeOpt.id, value: size, sort_order: 0 })
      .select()
      .single()
    if (error) throw error
    sizeValueMap.set(size, val.id)
  }

  const colorValueMap = new Map<string, string>()
  for (const color of matrix.colors) {
    const { data: val, error } = await supabase
      .from('product_option_values')
      .insert({ organization_id: orgId, option_id: colorOpt.id, value: color, sort_order: 0 })
      .select()
      .single()
    if (error) throw error
    colorValueMap.set(color, val.id)
  }

  for (const row of matrix.variants) {
    const { data: variant, error: vErr } = await supabase
      .from('product_variants')
      .insert({
        organization_id: orgId,
        product_id: product.id,
        sku: row.sku,
        barcode: row.barcode ?? null,
        name: row.name,
        purchase_price: row.purchase_price,
        selling_price: row.selling_price,
        wholesale_price: row.wholesale_price ?? null,
        is_active: row.is_active ?? true,
      })
      .select()
      .single()
    if (vErr) throw vErr

    const sizeValueId = sizeValueMap.get(row.size)
    const colorValueId = colorValueMap.get(row.color)
    if (!sizeValueId || !colorValueId) {
      throw new Error(`Missing option value for variant ${row.name}`)
    }

    const { error: linkErr } = await supabase.from('variant_option_values').insert([
      {
        organization_id: orgId,
        variant_id: variant.id,
        option_id: sizeOpt.id,
        option_value_id: sizeValueId,
      },
      {
        organization_id: orgId,
        variant_id: variant.id,
        option_id: colorOpt.id,
        option_value_id: colorValueId,
      },
    ])
    if (linkErr) throw linkErr
  }

  return product
}

export async function updateProduct(id: string, input: ProductInput) {
  const patch: TablesUpdate<'products'> = {
    name: input.name,
    description: input.description ?? null,
    category_id: input.category_id ?? null,
    subcategory_id: input.subcategory_id ?? null,
    brand_id: input.brand_id ?? null,
    product_type: input.product_type,
    unit: input.unit,
    base_sku: input.base_sku ?? null,
    base_barcode: input.base_barcode ?? null,
    purchase_price: input.purchase_price,
    selling_price: input.selling_price,
    wholesale_price: input.wholesale_price ?? null,
    reorder_level: input.reorder_level,
    tax_rate: input.tax_rate,
    is_active: input.is_active,
    track_inventory: input.track_inventory,
    has_variants: input.has_variants,
  }

  if (input.publish === true && input.is_active !== false) {
    patch.published_at = new Date().toISOString()
  } else if (input.publish === false) {
    patch.published_at = null
  }

  const { data, error } = await supabase
    .from('products')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function softDeleteProduct(id: string) {
  const { error } = await supabase
    .from('products')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', id)
  if (error) throw error
}

/* ── Variants ───────────────────────────────────────────────── */

export type VariantListItem = ProductVariant & {
  products?: { id: string; name: string } | null
  stockQty?: number
}

export async function listVariants(
  params: PageParams = {},
): Promise<PagedResult<VariantListItem>> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 50
  const { from, to } = range(page, pageSize)

  let q = supabase
    .from('product_variants')
    .select(
      `
      *,
      products!inner(id, name),
      inventory_balances(quantity, deleted_at)
    `,
      { count: 'exact' },
    )
    .is('deleted_at', null)
    .order('sku', { ascending: true })
    .range(from, to)

  if (params.productId) q = q.eq('product_id', params.productId)
  if (params.search?.trim()) {
    const s = params.search.trim()
    q = q.or(`sku.ilike.%${s}%,barcode.ilike.%${s}%,name.ilike.%${s}%`)
  }
  if (params.activeOnly) q = q.eq('is_active', true)

  const { data, error, count } = await q
  if (error) throw error

  const items = ((data ?? []) as unknown as Array<
    VariantListItem & {
      inventory_balances?: Array<{ quantity: number; deleted_at: string | null }>
    }
  >).map((row) => {
    const stockQty = (row.inventory_balances ?? [])
      .filter((b) => !b.deleted_at)
      .reduce((sum, b) => sum + Number(b.quantity ?? 0), 0)
    const { inventory_balances: _, ...rest } = row
    return { ...rest, stockQty }
  })

  return { items, total: count ?? 0, page, pageSize }
}

export async function updateVariant(
  id: string,
  input: Pick<
    TablesUpdate<'product_variants'>,
    | 'sku'
    | 'barcode'
    | 'name'
    | 'purchase_price'
    | 'selling_price'
    | 'wholesale_price'
    | 'is_active'
    | 'image_path'
  >,
) {
  const { data, error } = await supabase
    .from('product_variants')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function createVariant(
  orgId: string,
  input: {
    product_id: string
    sku: string
    barcode?: string | null
    name?: string | null
    purchase_price?: number
    selling_price?: number
    wholesale_price?: number | null
    is_active?: boolean
  },
) {
  const { data, error } = await supabase
    .from('product_variants')
    .insert({
      organization_id: orgId,
      product_id: input.product_id,
      sku: input.sku,
      barcode: input.barcode ?? null,
      name: input.name ?? null,
      purchase_price: input.purchase_price ?? 0,
      selling_price: input.selling_price ?? 0,
      wholesale_price: input.wholesale_price ?? null,
      is_active: input.is_active ?? true,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function softDeleteVariant(id: string) {
  const { error } = await supabase
    .from('product_variants')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', id)
  if (error) throw error
}

/* ── Product images ─────────────────────────────────────────── */

export const PRODUCT_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp'
export const PRODUCT_IMAGE_MAX_BYTES = 2 * 1024 * 1024
const PRODUCT_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function validateProductImageFile(file: File): string | null {
  if (!PRODUCT_IMAGE_TYPES.has(file.type)) {
    return 'Use a JPEG, PNG, or WebP image.'
  }
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
    return 'Image must be 2 MB or smaller.'
  }
  return null
}

export async function uploadProductImage(
  orgId: string,
  productId: string,
  file: File,
  options?: { isCover?: boolean; variantId?: string | null },
) {
  const validationError = validateProductImageFile(file)
  if (validationError) throw new Error(validationError)

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const variantId = options?.variantId ?? null
  const storagePath = variantId
    ? `${orgId}/products/${productId}/variants/${variantId}/${safeName}`
    : `${orgId}/products/${productId}/${safeName}`
  const isCover = variantId ? false : options?.isCover !== false

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'image/jpeg',
  })
  if (uploadError) throw uploadError

  if (isCover) {
    await supabase
      .from('product_images')
      .update({ is_cover: false })
      .eq('product_id', productId)
      .is('deleted_at', null)
      .is('variant_id', null)
  }

  if (variantId) {
    await supabase
      .from('product_images')
      .update({ deleted_at: new Date().toISOString() })
      .eq('product_id', productId)
      .eq('variant_id', variantId)
      .is('deleted_at', null)
  }

  const { data, error } = await supabase
    .from('product_images')
    .insert({
      organization_id: orgId,
      product_id: productId,
      variant_id: variantId,
      storage_path: storagePath,
      is_cover: isCover,
      metadata: { original_name: file.name, size: file.size, type: file.type },
    })
    .select()
    .single()
  if (error) throw error

  if (variantId) {
    await supabase
      .from('product_variants')
      .update({ image_path: storagePath })
      .eq('id', variantId)
  }

  const url = await resolveStorageUrl(storagePath)
  return { ...data, url }
}

export async function softDeleteProductImage(id: string) {
  const { data, error } = await supabase
    .from('product_images')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select('variant_id')
    .maybeSingle()
  if (error) throw error
  if (data?.variant_id) {
    await supabase
      .from('product_variants')
      .update({ image_path: null })
      .eq('id', data.variant_id)
  }
}

export async function clearVariantImage(variantId: string) {
  const now = new Date().toISOString()
  await supabase
    .from('product_images')
    .update({ deleted_at: now })
    .eq('variant_id', variantId)
    .is('deleted_at', null)
  const { error } = await supabase
    .from('product_variants')
    .update({ image_path: null })
    .eq('id', variantId)
  if (error) throw error
}

/* ── Phase 2–4 RPC helpers (cast until types regenerate) ── */

export async function createProductAtomic(payload: Record<string, unknown>) {
  const { data, error } = await untypedRpc('create_product_with_variants', { payload })
  if (error) throw error
  return data as {
    product_id?: string
    status?: string
    variants?: Array<{ id: string; sku?: string; key?: string }>
  }
}

export async function duplicateProduct(payload: Record<string, unknown>) {
  const { data, error } = await untypedRpc('duplicate_product', { payload })
  if (error) throw error
  return data as { product_id: string; status?: string }
}

export async function transitionProductStatus(payload: Record<string, unknown>) {
  const { data, error } = await untypedRpc('transition_product_status', { payload })
  if (error) throw error
  return data as { product_id?: string; status?: string }
}

export async function listExpiryAlerts(limit = 20): Promise<ExpiryAlertRow[]> {
  const { data, error } = await untypedFrom('expiry_alerts')
    .select(
      `
      id, product_id, variant_id, batch_id, severity, expires_at,
      quantity_available, message, is_read,
      products(name),
      product_variants(name, selling_price)
    `,
    )
    .eq('is_read', false)
    .order('expires_at', { ascending: true })
    .limit(limit)

  if (error) throw error

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const products = row.products as { name?: string } | null
    const variants = row.product_variants as { name?: string; selling_price?: number } | null
    return {
      id: row.id as string,
      product_id: row.product_id as string,
      variant_id: row.variant_id as string,
      batch_id: row.batch_id as string,
      severity: row.severity as string,
      expires_at: row.expires_at as string,
      quantity_available: Number(row.quantity_available ?? 0),
      message: row.message as string,
      is_read: Boolean(row.is_read),
      product_name: products?.name ?? null,
      variant_name: variants?.name ?? null,
      retail_hint: variants?.selling_price ?? null,
    }
  })
}

export async function listBranchPrices(
  productId: string,
  variantId?: string | null,
): Promise<BranchProductPrice[]> {
  let q = untypedFrom('branch_product_prices')
    .select('id, branch_id, product_id, variant_id, retail_price, wholesale_price, discount_price, is_active')
    .eq('product_id', productId)
    .is('deleted_at', null)
    .eq('is_active', true)

  if (variantId) q = q.eq('variant_id', variantId)
  else q = q.is('variant_id', null)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as BranchProductPrice[]
}

export async function upsertBranchPrice(input: {
  branch_id: string
  product_id: string
  variant_id?: string | null
  retail_price?: number | null
  wholesale_price?: number | null
  discount_price?: number | null
}) {
  const existing = await listBranchPrices(input.product_id, input.variant_id ?? null)
  const match = existing.find((p) => p.branch_id === input.branch_id)

  if (match) {
    const { data, error } = await untypedFrom('branch_product_prices')
      .update({
        retail_price: input.retail_price ?? null,
        wholesale_price: input.wholesale_price ?? null,
        discount_price: input.discount_price ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', match.id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  const orgId = (await supabase.from('products').select('organization_id').eq('id', input.product_id).single())
    .data?.organization_id
  if (!orgId) throw new Error('Product not found')

  const { data, error } = await untypedFrom('branch_product_prices')
    .insert({
      organization_id: orgId,
      branch_id: input.branch_id,
      product_id: input.product_id,
      variant_id: input.variant_id ?? null,
      retail_price: input.retail_price ?? null,
      wholesale_price: input.wholesale_price ?? null,
      discount_price: input.discount_price ?? null,
      is_active: true,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listProductAudit(productId: string): Promise<ProductAuditEntry[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, action, reason, after_data, before_data, created_at, actor_id')
    .eq('entity_type', 'product')
    .eq('entity_id', productId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []) as ProductAuditEntry[]
}

export type ProductInventorySummaryRow = {
  id: string
  name: string
  base_sku: string | null
  status: string | null
  reorder_level: number
  is_active: boolean
  category_id: string | null
  category_name: string | null
  variant_count: number
  total_stock: number
  stock_cost: number
  stock_value: number
  stock_status: string
  cover_path: string | null
}

export async function listProductsWithInventorySummary(
  params: PageParams & { branchId?: string | null } = {},
): Promise<PagedResult<ProductListItem>> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 24
  try {
    const { data, error } = await untypedRpc('list_products_with_inventory_summary', {
      payload: {
        search: params.search ?? null,
        category_id: params.categoryId ?? null,
        status: params.status ?? null,
        stock_status: params.stockStatus ?? null,
        branch_id: params.branchId ?? null,
        page,
        page_size: pageSize,
      },
    })
    if (error) throw error
    const row = data as { items?: ProductInventorySummaryRow[]; total?: number; page?: number; page_size?: number }
    const items = (row.items ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      base_sku: p.base_sku,
      status: p.status,
      reorder_level: p.reorder_level,
      is_active: p.is_active,
      category_id: p.category_id,
      totalStock: p.total_stock,
      variantCount: p.variant_count,
      categories: p.category_name ? { id: p.category_id ?? '', name: p.category_name } : null,
      coverUrl: p.cover_path,
    })) as unknown as ProductListItem[]
    return {
      items,
      total: row.total ?? 0,
      page: row.page ?? page,
      pageSize: row.page_size ?? pageSize,
    }
  } catch {
    return listProducts(params)
  }
}

export async function getProductVariantSummary(productId: string, branchId?: string | null) {
  const { data, error } = await untypedRpc('get_product_variant_summary', {
    p_product_id: productId,
    p_branch_id: branchId ?? null,
  })
  if (error) throw error
  return data as {
    product_id: string
    name: string
    status: string
    reorder_level: number
    variants: Array<{
      variant_id: string
      sku: string
      barcode: string | null
      name: string | null
      selling_price: number
      purchase_price: number
      is_active: boolean
      total_stock: number
      reserved: number
      available: number
    }>
  }
}

export async function getVariantBranchStock(variantId: string) {
  const { data, error } = await untypedRpc('get_variant_branch_stock', {
    p_variant_id: variantId,
  })
  if (error) throw error
  return (data ?? []) as Array<{
    branch_id: string
    branch_name: string
    branch_code: string
    location_id: string
    location_name: string
    quantity: number
    qty_reserved: number
    available: number
  }>
}

export const catalogRepository = {
  listCategories,
  searchCategories,
  createCategory,
  updateCategory,
  softDeleteCategory,
  listSubcategories,
  searchSubcategories,
  createSubcategory,
  updateSubcategory,
  softDeleteSubcategory,
  listBrands,
  searchBrands,
  createBrand,
  updateBrand,
  softDeleteBrand,
  listProducts,
  getProduct,
  getCategoryProductCounts,
  searchProducts,
  createProduct,
  createProductWithMatrix,
  updateProduct,
  softDeleteProduct,
  listVariants,
  updateVariant,
  createVariant,
  softDeleteVariant,
  uploadProductImage,
  softDeleteProductImage,
  clearVariantImage,
  validateProductImageFile,
  resolveStorageUrl,
  createProductAtomic,
  duplicateProduct,
  transitionProductStatus,
  listExpiryAlerts,
  listBranchPrices,
  upsertBranchPrice,
  listProductAudit,
  listProductsWithInventorySummary,
  getProductVariantSummary,
  getVariantBranchStock,
}
