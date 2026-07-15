import { supabase } from '@/lib/supabase/client'
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database'
import type { EntityOption } from '@/components/entity-combobox'

export type Category = Tables<'categories'>
export type Subcategory = Tables<'subcategories'>
export type Brand = Tables<'brands'>
export type Product = Tables<'products'>
export type ProductVariant = Tables<'product_variants'>
export type ProductImage = Tables<'product_images'>

export type PageParams = {
  search?: string
  page?: number
  pageSize?: number
  categoryId?: string | null
  brandId?: string | null
  activeOnly?: boolean
  productId?: string | null
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

  if (params.categoryId) q = q.eq('category_id', params.categoryId)
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
  categories?: { id: string; name: string } | null
  brands?: { id: string; name: string } | null
  subcategories?: { id: string; name: string } | null
  product_images?: Array<{ storage_path: string; is_cover: boolean; deleted_at: string | null }>
  coverUrl?: string | null
}

export async function listProducts(params: PageParams = {}): Promise<PagedResult<ProductListItem>> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 24
  const { from, to } = range(page, pageSize)

  let q = supabase
    .from('products')
    .select(
      `
      *,
      categories(id, name),
      brands(id, name),
      subcategories(id, name),
      product_images(storage_path, is_cover, deleted_at)
    `,
      { count: 'exact' },
    )
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .range(from, to)

  if (params.search?.trim()) {
    const s = params.search.trim()
    q = q.or(`name.ilike.%${s}%,base_sku.ilike.%${s}%,base_barcode.ilike.%${s}%`)
  }
  if (params.categoryId) q = q.eq('category_id', params.categoryId)
  if (params.brandId) q = q.eq('brand_id', params.brandId)
  if (params.activeOnly) q = q.eq('is_active', true)

  const { data, error, count } = await q
  if (error) throw error

  const items = await Promise.all(
    ((data ?? []) as unknown as ProductListItem[]).map(async (p) => {
      const images = (p.product_images ?? []).filter((i) => !i.deleted_at)
      const cover = images.find((i) => i.is_cover) ?? images[0]
      return { ...p, coverUrl: await resolveStorageUrl(cover?.storage_path) }
    }),
  )

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
}

export async function createProduct(orgId: string, input: ProductInput) {
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

export async function updateProduct(id: string, input: ProductInput) {
  const { data, error } = await supabase
    .from('products')
    .update({
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
    })
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

export async function uploadProductImage(
  orgId: string,
  productId: string,
  file: File,
  options?: { isCover?: boolean; variantId?: string | null },
) {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const storagePath = `${orgId}/${productId}/${safeName}`

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'image/jpeg',
  })
  if (uploadError) throw uploadError

  if (options?.isCover !== false) {
    await supabase
      .from('product_images')
      .update({ is_cover: false })
      .eq('product_id', productId)
      .is('deleted_at', null)
      .is('variant_id', null)
  }

  const { data, error } = await supabase
    .from('product_images')
    .insert({
      organization_id: orgId,
      product_id: productId,
      variant_id: options?.variantId ?? null,
      storage_path: storagePath,
      is_cover: options?.isCover !== false,
      metadata: { original_name: file.name, size: file.size, type: file.type },
    })
    .select()
    .single()
  if (error) throw error

  const url = await resolveStorageUrl(storagePath)
  return { ...data, url }
}

export async function softDeleteProductImage(id: string) {
  const { error } = await supabase
    .from('product_images')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
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
  searchProducts,
  createProduct,
  updateProduct,
  softDeleteProduct,
  listVariants,
  updateVariant,
  createVariant,
  softDeleteVariant,
  uploadProductImage,
  softDeleteProductImage,
  resolveStorageUrl,
}
