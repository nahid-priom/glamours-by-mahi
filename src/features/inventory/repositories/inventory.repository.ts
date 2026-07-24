import { supabase } from '@/lib/supabase/client'
import type { Json, Tables } from '@/types/database'
import type { EntityOption } from '@/components/entity-combobox'

export type StockLocation = Tables<'stock_locations'>
export type StockTransfer = Tables<'stock_transfers'>
export type StockLedgerRow = Tables<'stock_ledger'>

export type BranchStockRow = {
  balanceId: string
  variantId: string
  locationId: string
  branchId: string
  quantity: number
  sku: string
  barcode: string | null
  variantName: string | null
  productName: string
  productId: string
  locationName: string
  locationType: string
  branchName: string
  reorderLevel: number
}

export type LowStockRow = BranchStockRow & { shortage: number }

export type LedgerFilters = {
  branchId?: string | null
  variantId?: string | null
  search?: string
  page?: number
  pageSize?: number
  fromDate?: string | null
  toDate?: string | null
}

export type StockFilters = {
  branchId?: string | null
  search?: string
  page?: number
  pageSize?: number
}

function range(page: number, pageSize: number) {
  const from = (page - 1) * pageSize
  return { from, to: from + pageSize - 1 }
}

export async function listStockLocations(branchId: string): Promise<StockLocation[]> {
  const { data, error } = await supabase
    .from('stock_locations')
    .select('*')
    .eq('branch_id', branchId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function branchStock(
  filters: StockFilters = {},
): Promise<{ items: BranchStockRow[]; total: number }> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 50
  const { from, to } = range(page, pageSize)

  let locationIds: string[] | null = null
  if (filters.branchId) {
    const locs = await listStockLocations(filters.branchId)
    locationIds = locs.map((l) => l.id)
    if (locationIds.length === 0) return { items: [], total: 0 }
  }

  let q = supabase
    .from('inventory_balances')
    .select(
      `
      id,
      quantity,
      variant_id,
      location_id,
      product_variants!inner (
        id,
        sku,
        barcode,
        name,
        products!inner (
          id,
          name,
          reorder_level
        )
      ),
      stock_locations!inner (
        id,
        name,
        location_type,
        branch_id,
        branches!inner (
          id,
          name
        )
      )
    `,
      { count: 'exact' },
    )
    .is('deleted_at', null)
    .order('quantity', { ascending: true })
    .range(from, to)

  if (locationIds) {
    q = q.in('location_id', locationIds)
  }

  const { data, error, count } = await q
  if (error) throw error

  const search = filters.search?.trim().toLowerCase() ?? ''
  const mapped: BranchStockRow[] = ((data ?? []) as unknown as Array<Record<string, unknown>>)
    .map((row) => {
      const variant = row.product_variants as Record<string, unknown>
      const product = variant.products as Record<string, unknown>
      const location = row.stock_locations as Record<string, unknown>
      const branch = location.branches as Record<string, unknown>
      return {
        balanceId: row.id as string,
        variantId: variant.id as string,
        locationId: location.id as string,
        branchId: branch.id as string,
        quantity: Number(row.quantity ?? 0),
        sku: variant.sku as string,
        barcode: (variant.barcode as string | null) ?? null,
        variantName: (variant.name as string | null) ?? null,
        productName: product.name as string,
        productId: product.id as string,
        locationName: location.name as string,
        locationType: location.location_type as string,
        branchName: branch.name as string,
        reorderLevel: Number(product.reorder_level ?? 0),
      }
    })
    .filter((row) => {
      if (!search) return true
      return (
        row.sku.toLowerCase().includes(search) ||
        row.productName.toLowerCase().includes(search) ||
        (row.barcode ?? '').toLowerCase().includes(search)
      )
    })

  return { items: mapped, total: count ?? mapped.length }
}

export async function lowStock(
  filters: StockFilters = {},
): Promise<{ items: LowStockRow[]; total: number }> {
  const { items } = await branchStock({ ...filters, page: 1, pageSize: 500 })
  const low = items
    .filter((r) => r.reorderLevel > 0 && r.quantity <= r.reorderLevel)
    .map((r) => ({ ...r, shortage: r.reorderLevel - r.quantity }))
    .sort((a, b) => a.quantity - b.quantity)

  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 50
  const start = (page - 1) * pageSize
  return { items: low.slice(start, start + pageSize), total: low.length }
}

export async function ledger(
  filters: LedgerFilters = {},
): Promise<{ items: Array<StockLedgerRow & { sku?: string; productName?: string }>; total: number }> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 50
  const { from, to } = range(page, pageSize)

  let q = supabase
    .from('stock_ledger')
    .select(
      `
      *,
      product_variants!inner ( sku, name, products!inner ( name ) )
    `,
      { count: 'exact' },
    )
    .is('deleted_at', null)
    .order('occurred_at', { ascending: false })
    .range(from, to)

  if (filters.branchId) q = q.eq('branch_id', filters.branchId)
  if (filters.variantId) q = q.eq('variant_id', filters.variantId)
  if (filters.fromDate) q = q.gte('occurred_at', filters.fromDate)
  if (filters.toDate) q = q.lte('occurred_at', filters.toDate)

  const { data, error, count } = await q
  if (error) throw error

  const items = ((data ?? []) as unknown as Array<
    StockLedgerRow & {
      product_variants?: { sku: string; name: string | null; products?: { name: string } }
    }
  >).map((row) => ({
    ...row,
    sku: row.product_variants?.sku,
    productName: row.product_variants?.products?.name,
  }))

  return { items, total: count ?? 0 }
}

export type AdjustmentPayload = {
  branch_id: string
  location_id: string
  reason?: string
  notes?: string
  items: Array<{
    variant_id: string
    quantity_counted: number
    unit_cost?: number
    notes?: string
  }>
}

export async function createAdjustment(payload: AdjustmentPayload) {
  const { data, error } = await supabase.rpc('create_stock_adjustment', {
    payload: payload as unknown as Json,
  })
  if (error) throw error
  return data
}

export type CreateTransferInput = {
  organizationId: string
  fromBranchId: string
  toBranchId: string
  fromLocationId: string
  toLocationId: string
  notes?: string
  items: Array<{ variant_id: string; quantity_sent: number; unit_cost?: number; notes?: string }>
}

export async function createTransfer(input: CreateTransferInput) {
  const transferNo = `TR-${Date.now().toString(36).toUpperCase()}`
  const { data: transfer, error } = await supabase
    .from('stock_transfers')
    .insert({
      organization_id: input.organizationId,
      transfer_no: transferNo,
      from_branch_id: input.fromBranchId,
      to_branch_id: input.toBranchId,
      from_location_id: input.fromLocationId,
      to_location_id: input.toLocationId,
      status: 'draft',
      notes: input.notes ?? null,
    })
    .select()
    .single()
  if (error) throw error

  const rows = input.items.map((item) => ({
    organization_id: input.organizationId,
    transfer_id: transfer.id,
    variant_id: item.variant_id,
    quantity_sent: item.quantity_sent,
    unit_cost: item.unit_cost ?? null,
    notes: item.notes ?? null,
  }))

  const { error: itemsError } = await supabase.from('stock_transfer_items').insert(rows)
  if (itemsError) throw itemsError

  return transfer
}

export async function dispatch(transferId: string) {
  const { data, error } = await supabase.rpc('dispatch_stock_transfer', {
    transfer_id: transferId,
  })
  if (error) throw error
  return data
}

export async function receive(
  transferId: string,
  items?: Array<{
    variant_id: string
    quantity_received: number
    quantity_damaged?: number
    id?: string
    condition?: string
    notes?: string
  }>,
  finalize = false,
) {
  let receiveItems: Array<{ variant_id: string; quantity_received: number; id?: string }> =
    items ?? []
  if (!receiveItems.length) {
    const { data: rows, error: loadErr } = await supabase
      .from('stock_transfer_items')
      .select('id, variant_id, quantity_sent')
      .eq('transfer_id', transferId)
      .is('deleted_at', null)
    if (loadErr) throw loadErr
    receiveItems = (rows ?? []).map((r) => ({
      id: r.id,
      variant_id: r.variant_id,
      quantity_received: Number(r.quantity_sent),
    }))
  }

  const { data, error } = await supabase.rpc('receive_stock_transfer', {
    transfer_id: transferId,
    items: receiveItems as unknown as Json,
    finalize,
  })
  if (error) throw error
  return data
}

export async function listTransfers(
  filters: { branchId?: string | null; page?: number; pageSize?: number; status?: string } = {},
): Promise<{ items: StockTransfer[]; total: number }> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 50
  const { from, to } = range(page, pageSize)

  let q = supabase
    .from('stock_transfers')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters.status) {
    q = q.eq('status', filters.status as 'draft' | 'in_transit' | 'partially_received' | 'received' | 'cancelled')
  }
  if (filters.branchId) {
    q = q.or(`from_branch_id.eq.${filters.branchId},to_branch_id.eq.${filters.branchId}`)
  }

  const { data, error, count } = await q
  if (error) throw error
  return { items: data ?? [], total: count ?? 0 }
}

export async function getTransfer(id: string) {
  const { data, error } = await supabase
    .from('stock_transfers')
    .select(
      `
      *,
      stock_transfer_items (
        id,
        variant_id,
        quantity_sent,
        quantity_received,
        unit_cost,
        notes,
        deleted_at
      )
    `,
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function searchBranches(query: string): Promise<EntityOption[]> {
  const q = query.trim()
  let builder = supabase
    .from('branches')
    .select('id, name, code')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name')
    .limit(20)
  if (q) builder = builder.or(`name.ilike.%${q}%,code.ilike.%${q}%`)
  const { data, error } = await builder
  if (error) throw error
  return (data ?? []).map((b) => ({ id: b.id, label: b.name, description: b.code }))
}

export async function searchVariants(query: string): Promise<EntityOption[]> {
  const q = query.trim()
  let builder = supabase
    .from('product_variants')
    .select('id, sku, name, products!inner(name)')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('sku')
    .limit(20)
  if (q) builder = builder.or(`sku.ilike.%${q}%,barcode.ilike.%${q}%,name.ilike.%${q}%`)
  const { data, error } = await builder
  if (error) throw error
  return ((data ?? []) as unknown as Array<{
    id: string
    sku: string
    name: string | null
    products: { name: string }
  }>).map((v) => ({
    id: v.id,
    label: `${v.sku}${v.name ? ` · ${v.name}` : ''}`,
    description: v.products.name,
  }))
}

export const inventoryRepository = {
  listStockLocations,
  branchStock,
  lowStock,
  ledger,
  createAdjustment,
  createTransfer,
  dispatch,
  receive,
  listTransfers,
  getTransfer,
  searchBranches,
  searchVariants,
}
