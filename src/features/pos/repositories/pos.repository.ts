import { supabase } from '@/lib/supabase/client'
import type { Json } from '@/types/database'
import { calcCartTotals, calcLineTotal, normalizeBarcode } from '../cart-utils'
import type {
  CompletePosSalePayload,
  HeldSalePayload,
  PosVariant,
} from '../types'

type SearchPosVariantsArgs = {
  query: string
  branchId: string
  cursor?: string | null
  pageSize?: number
}

type SearchPosVariantsResult = {
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

function mapVariantRow(row: Record<string, unknown>, locationIds: string[]): PosVariant | null {
  const product = row.products as
    | {
        id: string
        name: string
        is_active: boolean
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

  if (!product || product.deleted_at || !product.is_active) return null
  if (row.deleted_at || row.is_active === false) return null

  const balances = (row.inventory_balances as Array<{
    quantity: number
    location_id: string
    deleted_at: string | null
  }> | null) ?? []

  const availableStock = balances
    .filter((b) => !b.deleted_at && locationIds.includes(b.location_id))
    .reduce((sum, b) => sum + Number(b.quantity ?? 0), 0)

  const images = product.product_images ?? []
  const cover =
    images.find((img) => !img.deleted_at && img.is_cover && !img.variant_id) ??
    images.find((img) => !img.deleted_at && img.variant_id === row.id) ??
    images.find((img) => !img.deleted_at)

  const variantLabel = (row.name as string | null) || 'Default'

  return {
    variantId: row.id as string,
    productId: product.id,
    productName: product.name,
    variantLabel,
    sku: row.sku as string,
    barcode: (row.barcode as string | null) ?? null,
    thumbnailUrl: (row.image_path as string | null) || cover?.storage_path || null,
    unitPrice: Number(row.selling_price ?? 0),
    availableStock,
  }
}

export async function searchPosVariants({
  query,
  branchId,
  cursor,
  pageSize = 24,
}: SearchPosVariantsArgs): Promise<SearchPosVariantsResult> {
  const locationIds = await getSaleableLocationIds(branchId)
  const q = query.trim()

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
        location_id,
        deleted_at
      )
    `,
    )
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('sku', { ascending: true })
    .limit(pageSize)

  if (q) {
    builder = builder.or(`sku.ilike.%${q}%,barcode.ilike.%${q}%,name.ilike.%${q}%`)
  }
  if (cursor) {
    builder = builder.gt('sku', cursor)
  }

  const { data, error } = await builder
  if (error) throw error

  const items = ((data ?? []) as unknown as Record<string, unknown>[])
    .map((row) => mapVariantRow(row, locationIds))
    .filter((v): v is PosVariant => v !== null)

  // Secondary filter by product name when query present
  const filtered =
    q.length === 0
      ? items
      : items.filter(
          (v) =>
            v.sku.toLowerCase().includes(q.toLowerCase()) ||
            (v.barcode ?? '').toLowerCase().includes(q.toLowerCase()) ||
            v.variantLabel.toLowerCase().includes(q.toLowerCase()) ||
            v.productName.toLowerCase().includes(q.toLowerCase()),
        )

  const nextCursor =
    (data?.length ?? 0) >= pageSize ? ((data![data!.length - 1] as { sku: string }).sku ?? null) : null

  return { items: filtered, nextCursor }
}

export async function findVariantByBarcodeExact(
  barcode: string,
  branchId: string,
): Promise<PosVariant | null> {
  const code = normalizeBarcode(barcode)
  if (!code) return null

  const locationIds = await getSaleableLocationIds(branchId)

  const { data, error } = await supabase
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
        location_id,
        deleted_at
      )
    `,
    )
    .eq('is_active', true)
    .is('deleted_at', null)
    .ilike('barcode', code)
    .limit(5)

  if (error) throw error

  const rows = (data ?? []) as unknown as Record<string, unknown>[]
  const exact = rows.find((r) => normalizeBarcode(String(r.barcode ?? '')) === code)
  if (!exact) return null
  return mapVariantRow(exact, locationIds)
}

export async function completeSale(payload: CompletePosSalePayload) {
  const { data, error } = await supabase.rpc('complete_pos_sale', {
    payload: payload as unknown as Json,
  })
  if (error) throw error
  return data
}

export async function searchCustomers(query: string): Promise<
  Array<{ id: string; label: string; description?: string }>
> {
  const q = query.trim()
  let builder = supabase
    .from('customers')
    .select('id, name, phone, email')
    .is('deleted_at', null)
    .neq('status', 'archived')
    .order('name', { ascending: true })
    .limit(20)

  if (q) {
    builder = builder.or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
  }

  const { data, error } = await builder
  if (error) throw error

  return (data ?? []).map((c) => ({
    id: c.id,
    label: c.name,
    description: c.phone,
  }))
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

  const { data: held, error } = await supabase
    .from('held_sales')
    .insert({
      organization_id: organizationId,
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
    })
    .select('id')
    .single()

  if (error) throw error

  const items = payload.lines.map((line, index) => ({
    organization_id: organizationId,
    held_sale_id: held.id,
    variant_id: line.variantId,
    qty: line.qty,
    unit_price: line.unitPrice,
    line_discount: line.lineDiscount,
    line_total: calcLineTotal(line),
    sort_order: index,
  }))

  const { error: itemsError } = await supabase.from('held_sale_items').insert(items)
  if (itemsError) throw itemsError

  return held
}

export async function deleteHeldSale(heldSaleId: string) {
  const now = new Date().toISOString()
  const { error: itemsError } = await supabase
    .from('held_sale_items')
    .update({ deleted_at: now })
    .eq('held_sale_id', heldSaleId)
    .is('deleted_at', null)

  if (itemsError) throw itemsError

  const { error } = await supabase
    .from('held_sales')
    .update({ deleted_at: now })
    .eq('id', heldSaleId)

  if (error) throw error
}

export const posRepository = {
  searchPosVariants,
  findVariantByBarcodeExact,
  completeSale,
  searchCustomers,
  listPaymentMethods,
  listFinancialAccounts,
  listHeldSales,
  saveHeldSale,
  deleteHeldSale,
}
