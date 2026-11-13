import { supabase } from '@/lib/supabase/client'
import { resolveStorageUrl } from '@/features/products/repositories/catalog.repository'
import type { Json, TablesInsert } from '@/types/database'
import { normalizeBdPhone } from '@/lib/phone-utils'
import { calcCartTotals, calcLineTotal, normalizeBarcode } from '../cart-utils'
import type {
  CartLine,
  CartState,
  CompletePosSalePayload,
  HeldSalePayload,
  PosVariant,
} from '../types'

type UntypedRpc = (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>

const untypedRpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc

type ListPosCatalogueArgs = {
  branchId: string
  cursor?: string | null
  pageSize?: number
  signal?: AbortSignal
}

type ListPosCatalogueResult = {
  items: PosVariant[]
  nextCursor: string | null
}

async function getSaleableLocationIds(branchId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('stock_locations')
    .select('id')
    .eq('branch_id', branchId)
    .eq('location_type', 'saleable')
    .eq('is_active', true)
    .is('deleted_at', null)

  if (error) throw error
  return (data ?? []).map((r) => r.id)
}

async function resolveThumbnail(
  imagePath: string | null | undefined,
  coverPath: string | null | undefined,
): Promise<string | null> {
  const raw = imagePath || coverPath || null
  if (!raw) return null
  return resolveStorageUrl(raw)
}

function mapVariantRow(
  row: Record<string, unknown>,
  locationIds: string[],
  thumbnailUrl: string | null,
): PosVariant | null {
  const product = row.products as
    | {
        id: string
        name: string
        is_active: boolean
        deleted_at: string | null
        status?: string
        category_id?: string | null
        categories?: { name: string } | { name: string }[] | null
        product_images?: Array<{
          storage_path: string
          is_cover: boolean
          deleted_at: string | null
          variant_id: string | null
        }>
      }
    | null
    | undefined

  if (!product || product.deleted_at || !product.is_active) return null
  if (product.status && product.status !== 'active') return null
  if (row.deleted_at || row.is_active === false) return null

  const balances =
    (row.inventory_balances as Array<{
      quantity: number
      qty_reserved?: number
      location_id: string
      deleted_at: string | null
    }> | null) ?? []

  const availableStock = balances
    .filter((b) => !b.deleted_at && locationIds.includes(b.location_id))
    .reduce((sum, b) => {
      const available =
        Number(b.quantity ?? 0) - Number(b.qty_reserved ?? 0)
      return sum + Math.max(available, 0)
    }, 0)

  const variantLabel = (row.name as string | null) || 'Default'
  const cat = product.categories
  const categoryName = Array.isArray(cat) ? cat[0]?.name : cat?.name

  return {
    variantId: row.id as string,
    productId: product.id,
    productName: product.name,
    variantLabel,
    sku: row.sku as string,
    barcode: (row.barcode as string | null) ?? null,
    thumbnailUrl,
    unitPrice: Number(row.selling_price ?? 0),
    availableStock,
    categoryId: product.category_id ?? null,
    categoryName: categoryName ?? null,
  }
}

function mapVariantRowForResume(
  row: Record<string, unknown>,
  locationIds: string[],
  thumbnailUrl: string | null,
): PosVariant | null {
  if (row.deleted_at) return null

  const product = row.products as
    | {
        id: string
        name: string
        deleted_at: string | null
        product_images?: Array<{
          storage_path: string
          is_cover: boolean
          deleted_at: string | null
          variant_id: string | null
        }>
      }
    | null
    | undefined

  const balances =
    (row.inventory_balances as Array<{
      quantity: number
      qty_reserved?: number
      location_id: string
      deleted_at: string | null
    }> | null) ?? []

  const availableStock = balances
    .filter((b) => !b.deleted_at && locationIds.includes(b.location_id))
    .reduce((sum, b) => {
      const available =
        Number(b.quantity ?? 0) - Number(b.qty_reserved ?? 0)
      return sum + Math.max(available, 0)
    }, 0)

  const variantLabel = (row.name as string | null) || 'Default'
  const productId = product?.id ?? (row.product_id as string)
  const productName =
    product && !product.deleted_at ? product.name : 'Product'

  return {
    variantId: row.id as string,
    productId,
    productName,
    variantLabel,
    sku: (row.sku as string | null) ?? '—',
    barcode: (row.barcode as string | null) ?? null,
    thumbnailUrl,
    unitPrice: Number(row.selling_price ?? 0),
    availableStock,
  }
}

function pickCoverPath(row: Record<string, unknown>): string | null {
  const product = row.products as
    | {
        product_images?: Array<{
          storage_path: string
          is_cover: boolean
          deleted_at: string | null
          variant_id: string | null
        }>
      }
    | null
    | undefined

  const images = product?.product_images ?? []
  const cover =
    images.find((img) => !img.deleted_at && img.is_cover && !img.variant_id) ??
    images.find((img) => !img.deleted_at && img.variant_id === row.id) ??
    images.find((img) => !img.deleted_at)

  return (row.image_path as string | null) || cover?.storage_path || null
}

/** Paginated catalogue browse — no name/SKU search. */
export async function listPosCatalogue({
  branchId,
  cursor,
  pageSize = 24,
  signal,
}: ListPosCatalogueArgs): Promise<ListPosCatalogueResult> {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  const locationIds = await getSaleableLocationIds(branchId)

  let builder = supabase
    .from('product_variants')
    .select(
      `
      id,
      sku,
      barcode,
      name,
      selling_price,
      image_path,
      product_id,
      is_active,
      deleted_at,
      products!inner (
        id,
        name,
        is_active,
        status,
        deleted_at,
        category_id,
        categories ( name ),
        product_images (
          storage_path,
          is_cover,
          deleted_at,
          variant_id
        )
      ),
      inventory_balances (
        quantity,
        qty_reserved,
        location_id,
        deleted_at
      )
    `,
    )
    .eq('is_active', true)
    .is('deleted_at', null)
    .eq('products.status', 'active')
    .order('sku', { ascending: true })
    .limit(pageSize)

  if (cursor) {
    builder = builder.gt('sku', cursor)
  }

  const { data, error } = await builder
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  if (error) throw error

  const rows = (data ?? []) as unknown as Record<string, unknown>[]
  const mapped = await Promise.all(
    rows.map(async (row) => {
      const thumb = await resolveThumbnail(pickCoverPath(row), null)
      return mapVariantRow(row, locationIds, thumb)
    }),
  )

  const items = mapped.filter((v): v is PosVariant => v !== null)
  const nextCursor =
    rows.length >= pageSize ? ((rows[rows.length - 1] as { sku: string }).sku ?? null) : null

  return { items, nextCursor }
}

/** @deprecated Prefer listPosCatalogue — kept for HeldSales / transitional callers. */
export async function searchPosVariants({
  branchId,
  cursor,
  pageSize = 24,
}: {
  query?: string
  branchId: string
  cursor?: string | null
  pageSize?: number
}): Promise<ListPosCatalogueResult> {
  return listPosCatalogue({ branchId, cursor, pageSize })
}

/** Exact barcode lookup via indexed server RPC. Never loads the full product table. */
export async function findVariantByBarcodeExact(
  barcode: string,
  branchId: string,
): Promise<PosVariant | null> {
  const code = normalizeBarcode(barcode)
  if (!code) return null

  const { data, error } = await untypedRpc('pos_lookup_variant_by_barcode', {
    p_barcode: code,
    p_branch_id: branchId,
  })

  if (error) throw error
  if (!data || typeof data !== 'object') return null

  const row = data as Record<string, unknown>
  const thumbRaw = (row.thumbnailUrl as string | null) ?? null
  const thumbnailUrl = await resolveThumbnail(thumbRaw, null)

  return {
    variantId: String(row.variantId),
    productId: String(row.productId),
    productName: String(row.productName ?? ''),
    variantLabel: String(row.variantLabel ?? 'Default'),
    sku: String(row.sku ?? ''),
    barcode: (row.barcode as string | null) ?? null,
    thumbnailUrl,
    unitPrice: Number(row.unitPrice ?? 0),
    availableStock: Number(row.availableStock ?? 0),
  }
}

export async function completeSale(payload: CompletePosSalePayload) {
  const { data, error } = await supabase.rpc('complete_pos_sale', {
    payload: payload as unknown as Json,
  })
  if (error) throw error
  return data
}

export type PosCustomerOption = { id: string; label: string; description?: string }

/** Presentational label — falls back to the mobile number when the name is empty. */
function toCustomerOption(row: {
  id: string
  name: string | null
  phone: string | null
}): PosCustomerOption {
  const name = row.name?.trim() ?? ''
  const phone = row.phone ?? ''
  return {
    id: row.id,
    label: name || (phone ? `Customer • ${phone}` : 'Customer'),
    description: name && phone ? phone : undefined,
  }
}

/** Server-side, tenant-scoped (RLS) customer search by name or mobile. */
export async function searchCustomers(query: string): Promise<PosCustomerOption[]> {
  const q = query.trim()
  let builder = supabase
    .from('customers')
    .select('id, name, phone, email')
    .is('deleted_at', null)
    .neq('status', 'archived')
    .order('name', { ascending: true })
    .limit(20)

  if (q) {
    // Match either the raw query or its digit-normalized mobile form.
    const normalizedMobile = normalizeBdPhone(q)
    const filters = [`name.ilike.%${q}%`, `phone.ilike.%${q}%`, `email.ilike.%${q}%`]
    if (normalizedMobile && normalizedMobile !== q) {
      filters.push(`phone.ilike.%${normalizedMobile}%`)
    }
    builder = builder.or(filters.join(','))
  }

  const { data, error } = await builder
  if (error) throw error

  return (data ?? []).map(toCustomerOption)
}

export type QuickCreateCustomerInput = {
  mobile: string
  name?: string | null
  organizationId: string
  branchId?: string | null
  createdBy?: string | null
}

export type QuickCreateCustomerResult = {
  customer: PosCustomerOption
  existing: boolean
}

async function findActiveCustomerByPhone(phone: string): Promise<PosCustomerOption | null> {
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, phone')
    .eq('phone', phone)
    .is('deleted_at', null)
    .neq('status', 'archived')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data ? toCustomerOption(data) : null
}

/**
 * POS Customer Quick Add. Normalizes the mobile, prevents duplicates
 * (server-side lookup + unique-violation race handling) and creates a
 * tenant-scoped customer using the secure customers table (RLS enforced).
 */
export async function quickCreateCustomer(
  input: QuickCreateCustomerInput,
): Promise<QuickCreateCustomerResult> {
  const phone = normalizeBdPhone(input.mobile)
  if (!phone) throw new Error('সঠিক মোবাইল নম্বর দিন')

  const existing = await findActiveCustomerByPhone(phone)
  if (existing) return { customer: existing, existing: true }

  const name = input.name?.trim() ?? ''
  const payload: TablesInsert<'customers'> = {
    organization_id: input.organizationId,
    branch_id: input.branchId ?? null,
    name,
    phone,
    status: 'active',
    current_due: 0,
    created_by: input.createdBy ?? null,
  }

  const { data, error } = await supabase
    .from('customers')
    .insert(payload)
    .select('id, name, phone')
    .single()

  if (error) {
    // 23505 = unique_violation → another session created it first.
    if ((error as { code?: string }).code === '23505') {
      const raced = await findActiveCustomerByPhone(phone)
      if (raced) return { customer: raced, existing: true }
    }
    throw error
  }

  return { customer: toCustomerOption(data), existing: false }
}

export async function listPaymentMethods() {
  const { data, error } = await supabase
    .from('payment_methods')
    .select('id, code, name, financial_account_id, is_due, is_active, sort_order')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function listFinancialAccounts(branchId?: string | null) {
  let builder = supabase
    .from('financial_accounts')
    .select('id, name, account_kind, branch_id, is_default')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (branchId) {
    builder = builder.or(`branch_id.eq.${branchId},branch_id.is.null`)
  }

  const { data, error } = await builder
  if (error) throw error
  return data ?? []
}

export async function listHeldSales(branchId: string) {
  const { data, error } = await supabase
    .from('held_sales')
    .select(
      `
      id,
      hold_label,
      note,
      customer_id,
      subtotal,
      discount,
      tax,
      shipping,
      grand_total,
      created_at,
      held_sale_items (
        id,
        variant_id,
        qty,
        unit_price,
        line_discount,
        line_total,
        sort_order
      )
    `,
    )
    .eq('branch_id', branchId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function saveHeldSale(
  payload: HeldSalePayload,
  organizationId: string,
  salespersonId?: string | null,
) {
  void organizationId
  const totals = calcCartTotals({
    lines: payload.lines,
    customerId: payload.customerId,
    customerLabel: payload.customerLabel,
    invoiceDiscount: payload.invoiceDiscount,
    tax: payload.tax,
    shipping: payload.shipping,
    payments: payload.payments,
    note: payload.note,
  })

  const { data, error } = await untypedRpc('upsert_held_sale', {
    payload: {
      branch_id: payload.branchId,
      customer_id: payload.customerId,
      salesperson_id: salespersonId ?? null,
      hold_label: payload.holdLabel ?? null,
      note: payload.note || null,
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax: totals.tax,
      shipping: totals.shipping,
      grand_total: totals.grandTotal,
      items: payload.lines.map((line, index) => ({
        variant_id: line.variantId,
        qty: line.qty,
        unit_price: line.unitPrice,
        line_discount: line.lineDiscount,
        line_total: calcLineTotal(line),
        sort_order: index,
      })),
    },
  })
  if (error) throw error
  const heldSaleId = (data as { held_sale_id?: string } | null)?.held_sale_id
  if (!heldSaleId) throw new Error('Failed to hold sale')
  return { id: heldSaleId }
}

export type HeldSaleResume = CartState & { heldSaleId: string }

export async function getHeldSaleForResume(
  heldSaleId: string,
  branchId: string,
): Promise<HeldSaleResume> {
  const { data: held, error } = await supabase
    .from('held_sales')
    .select(
      `
      id,
      branch_id,
      customer_id,
      note,
      discount,
      tax,
      shipping,
      held_sale_items (
        variant_id,
        qty,
        unit_price,
        line_discount,
        sort_order,
        deleted_at
      )
    `,
    )
    .eq('id', heldSaleId)
    .is('deleted_at', null)
    .single()

  if (error) throw error

  if (held.branch_id !== branchId) {
    throw new Error('This held sale belongs to a different branch. Switch branch and try again.')
  }

  type HeldItemRow = {
    variant_id: string
    qty: number
    unit_price: number
    line_discount: number
    sort_order: number
    deleted_at: string | null
  }

  const rawItems = ((held.held_sale_items ?? []) as HeldItemRow[])
    .filter((item) => !item.deleted_at)
    .sort((a, b) => a.sort_order - b.sort_order)

  if (rawItems.length === 0) throw new Error('Held sale has no items')

  let customerLabel: string | null = null
  if (held.customer_id) {
    const { data: customer } = await supabase
      .from('customers')
      .select('name')
      .eq('id', held.customer_id)
      .is('deleted_at', null)
      .maybeSingle()
    customerLabel = customer?.name ?? null
  }

  const variantIds = [...new Set(rawItems.map((item) => item.variant_id))]
  const locationIds = await getSaleableLocationIds(branchId)

  const { data: variants, error: variantsError } = await supabase
    .from('product_variants')
    .select(
      `
      id,
      sku,
      barcode,
      name,
      selling_price,
      image_path,
      product_id,
      deleted_at,
      products (
        id,
        name,
        deleted_at,
        product_images (
          storage_path,
          is_cover,
          deleted_at,
          variant_id
        )
      ),
      inventory_balances (
        quantity,
        qty_reserved,
        location_id,
        deleted_at
      )
    `,
    )
    .in('id', variantIds)
    .is('deleted_at', null)

  if (variantsError) throw variantsError

  const variantMap = new Map<string, PosVariant>()
  for (const row of (variants ?? []) as unknown as Record<string, unknown>[]) {
    const thumb = await resolveThumbnail(pickCoverPath(row), null)
    const mapped = mapVariantRowForResume(row, locationIds, thumb)
    if (mapped) variantMap.set(mapped.variantId, mapped)
  }

  const lines: CartLine[] = []
  for (const item of rawItems) {
    const variant = variantMap.get(item.variant_id)
    const qty = Number(item.qty)
    const unitPrice = Number(item.unit_price)
    const lineDiscount = Number(item.line_discount ?? 0)

    if (!variant) {
      lines.push({
        variantId: item.variant_id,
        productId: item.variant_id,
        productName: 'Unavailable product',
        variantLabel: '—',
        sku: '—',
        barcode: '',
        unitPrice,
        qty,
        lineDiscount,
        availableStock: qty,
      })
      continue
    }

    lines.push({
      variantId: item.variant_id,
      productId: variant.productId,
      productName: variant.productName,
      variantLabel: variant.variantLabel,
      sku: variant.sku,
      barcode: variant.barcode ?? '',
      thumbnailUrl: variant.thumbnailUrl ?? undefined,
      unitPrice,
      qty,
      lineDiscount,
      availableStock: variant.availableStock,
    })
  }

  return {
    heldSaleId: held.id,
    lines,
    customerId: held.customer_id,
    customerLabel,
    invoiceDiscount: Number(held.discount ?? 0),
    tax: Number(held.tax ?? 0),
    shipping: Number(held.shipping ?? 0),
    payments: [],
    note: held.note ?? '',
  }
}

export async function deleteHeldSale(heldSaleId: string) {
  const { error } = await untypedRpc('delete_held_sale', {
    p_held_sale_id: heldSaleId,
  })
  if (error) throw error
}

export const posRepository = {
  listPosCatalogue,
  searchPosVariants,
  findVariantByBarcodeExact,
  completeSale,
  searchCustomers,
  quickCreateCustomer,
  listPaymentMethods,
  listFinancialAccounts,
  listHeldSales,
  getHeldSaleForResume,
  saveHeldSale,
  deleteHeldSale,
}
