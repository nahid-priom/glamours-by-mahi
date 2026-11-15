import { supabase } from '@/lib/supabase/client'
import { toQueryBounds } from '@/lib/datetime/bd'
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
  qtyReserved: number
  available: number
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

export const STOCK_MOVEMENT_TYPES = [
  'opening',
  'purchase',
  'purchase_return',
  'sale',
  'sale_return',
  'adjustment',
  'transfer_out',
  'transfer_in',
  'damage',
  'quarantine',
  'correction',
] as const

export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number]

export type LedgerFilters = {
  branchId?: string | null
  variantId?: string | null
  productId?: string | null
  locationId?: string | null
  movementTypes?: string[]
  search?: string
  page?: number
  pageSize?: number
  fromDate?: string | null
  toDate?: string | null
  /** Default: asc when variantId set (birth-to-date), else desc */
  sortDir?: 'asc' | 'desc'
}

export type LedgerListItem = StockLedgerRow & {
  sku?: string
  productName?: string
  variantName?: string | null
  productId?: string
  locationName?: string
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

async function resolveStockVariantIds(search?: string): Promise<string[] | null> {
  const s = search?.trim()
  if (!s) return null

  const safe = s.replace(/%/g, '')
  const { data, error } = await supabase
    .from('product_variants')
    .select('id, products!inner(name)')
    .is('deleted_at', null)
    .or(`sku.ilike.%${safe}%,barcode.ilike.%${safe}%,name.ilike.%${safe}%`)
    .limit(500)
  if (error) throw error

  const ids = new Set((data ?? []).map((row) => row.id as string))
  if (ids.size === 0) {
    const { data: products, error: prodErr } = await supabase
      .from('products')
      .select('id')
      .is('deleted_at', null)
      .ilike('name', `%${safe}%`)
      .limit(100)
    if (prodErr) throw prodErr
    const productIds = (products ?? []).map((p) => p.id as string)
    if (productIds.length === 0) return []
    const { data: byName, error: nameErr } = await supabase
      .from('product_variants')
      .select('id')
      .is('deleted_at', null)
      .in('product_id', productIds)
      .limit(500)
    if (nameErr) throw nameErr
    return (byName ?? []).map((row) => row.id as string)
  }
  return [...ids]
}

function mapBranchStockRow(row: Record<string, unknown>): BranchStockRow {
  const variant = row.product_variants as Record<string, unknown>
  const product = variant.products as Record<string, unknown>
  const location = row.stock_locations as Record<string, unknown>
  const branch = location.branches as Record<string, unknown>
  const quantity = Number(row.quantity ?? 0)
  const qtyReserved = Number(row.qty_reserved ?? 0)
  return {
    balanceId: row.id as string,
    variantId: variant.id as string,
    locationId: location.id as string,
    branchId: branch.id as string,
    quantity,
    qtyReserved,
    available: Math.max(quantity - qtyReserved, 0),
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

  const variantIds = await resolveStockVariantIds(filters.search)
  if (variantIds && variantIds.length === 0) return { items: [], total: 0 }

  let q = supabase
    .from('inventory_balances')
    .select(
      `
      id,
      quantity,
      qty_reserved,
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
  if (variantIds) {
    q = q.in('variant_id', variantIds)
  }

  const { data, error, count } = await q
  if (error) throw error

  const mapped = ((data ?? []) as unknown as Array<Record<string, unknown>>).map(mapBranchStockRow)
  return { items: mapped, total: count ?? mapped.length }
}

export async function lowStock(
  filters: StockFilters = {},
): Promise<{ items: LowStockRow[]; total: number }> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 50
  // Fetch a wider window then filter/page in memory — available qty drives low-stock.
  const { items } = await branchStock({
    branchId: filters.branchId,
    search: filters.search,
    page: 1,
    pageSize: 2000,
  })
  const low = items
    .filter((r) => r.reorderLevel > 0 && r.available <= r.reorderLevel)
    .map((r) => ({ ...r, shortage: r.reorderLevel - r.available }))
    .sort((a, b) => a.available - b.available)

  const start = (page - 1) * pageSize
  return { items: low.slice(start, start + pageSize), total: low.length }
}

async function resolveLedgerVariantIds(filters: LedgerFilters): Promise<string[] | null> {
  const search = filters.search?.trim()
  const productId = filters.productId?.trim() || null
  if (!search && !productId) return null

  let builder = supabase
    .from('product_variants')
    .select('id, products!inner(name)')
    .is('deleted_at', null)
    .limit(500)

  if (productId) builder = builder.eq('product_id', productId)
  if (search) {
    const s = search.replace(/%/g, '')
    builder = builder.or(`sku.ilike.%${s}%,barcode.ilike.%${s}%,name.ilike.%${s}%`)
  }

  const { data, error } = await builder
  if (error) throw error

  const ids = (data ?? []).map((row) => row.id as string)
  if (ids.length === 0 && search) {
    const s = search.replace(/%/g, '')
    let productsQ = supabase
      .from('products')
      .select('id')
      .is('deleted_at', null)
      .ilike('name', `%${s}%`)
      .limit(100)
    if (productId) productsQ = productsQ.eq('id', productId)
    const { data: products, error: prodErr } = await productsQ
    if (prodErr) throw prodErr
    const productIds = (products ?? []).map((p) => p.id as string)
    if (productIds.length === 0) return []
    const { data: byName, error: nameErr } = await supabase
      .from('product_variants')
      .select('id')
      .is('deleted_at', null)
      .in('product_id', productIds)
      .limit(500)
    if (nameErr) throw nameErr
    return (byName ?? []).map((row) => row.id as string)
  }
  return ids
}

export async function ledger(
  filters: LedgerFilters = {},
): Promise<{ items: LedgerListItem[]; total: number }> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 50
  const { from, to } = range(page, pageSize)
  const sortAsc =
    filters.sortDir === 'asc' ||
    (filters.sortDir !== 'desc' && Boolean(filters.variantId))

  let variantIds: string[] | null = null
  if (filters.variantId) {
    variantIds = [filters.variantId]
  } else if (filters.productId || filters.search?.trim()) {
    variantIds = await resolveLedgerVariantIds(filters)
    if (variantIds?.length === 0) return { items: [], total: 0 }
  }

  let q = supabase
    .from('stock_ledger')
    .select(
      `
      *,
      product_variants!inner ( id, sku, name, product_id, products!inner ( id, name ) ),
      stock_locations!inner ( id, name )
    `,
      { count: 'exact' },
    )
    .is('deleted_at', null)
    .order('occurred_at', { ascending: sortAsc })
    .order('id', { ascending: sortAsc })
    .range(from, to)

  if (filters.branchId) q = q.eq('branch_id', filters.branchId)
  if (variantIds) q = q.in('variant_id', variantIds)
  if (filters.locationId) q = q.eq('location_id', filters.locationId)
  if (filters.movementTypes && filters.movementTypes.length > 0) {
    q = q.in('movement_type', filters.movementTypes)
  }
  if (filters.fromDate || filters.toDate) {
    const bounds = toQueryBounds(
      filters.fromDate?.includes('T') ? filters.fromDate.slice(0, 10) : filters.fromDate,
      filters.toDate?.includes('T') ? filters.toDate.slice(0, 10) : filters.toDate,
    )
    if (bounds.fromIso) q = q.gte('occurred_at', bounds.fromIso)
    if (bounds.toIso) q = q.lte('occurred_at', bounds.toIso)
  }

  const { data, error, count } = await q
  if (error) throw error

  const items = ((data ?? []) as unknown as Array<
    StockLedgerRow & {
      product_variants?: {
        id: string
        sku: string
        name: string | null
        product_id: string
        products?: { id: string; name: string }
      }
      stock_locations?: { id: string; name: string }
    }
  >).map((row) => {
    const { product_variants: pv, stock_locations: loc, ...rest } = row
    return {
      ...rest,
      sku: pv?.sku,
      productName: pv?.products?.name,
      variantName: pv?.name ?? null,
      productId: pv?.product_id ?? pv?.products?.id,
      locationName: loc?.name,
    }
  })

  return { items, total: count ?? 0 }
}

export type AdjustmentPayload = {
  branch_id: string
  location_id: string
  reason?: string
  notes?: string
  client_txn_key?: string
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
  type UntypedRpc = (
    fn: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>
  const untypedRpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc

  const { data, error } = await untypedRpc('create_stock_transfer', {
    payload: {
      from_branch_id: input.fromBranchId,
      to_branch_id: input.toBranchId,
      from_location_id: input.fromLocationId,
      to_location_id: input.toLocationId,
      notes: input.notes ?? null,
      items: input.items.map((item) => ({
        variant_id: item.variant_id,
        quantity_sent: item.quantity_sent,
        unit_cost: item.unit_cost ?? null,
        notes: item.notes ?? null,
      })),
    },
  })
  if (error) throw error
  const result = data as { transfer_id?: string; transfer_no?: string; status?: string } | null
  if (!result?.transfer_id) throw new Error('Failed to create transfer')

  const { data: transfer, error: loadError } = await supabase
    .from('stock_transfers')
    .select()
    .eq('id', result.transfer_id)
    .single()
  if (loadError) throw loadError
  return transfer
}

export async function cancelTransfer(transferId: string, reason?: string) {
  type UntypedRpc = (
    fn: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>
  const untypedRpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc
  const { data, error } = await untypedRpc('cancel_stock_transfer', {
    p_transfer_id: transferId,
    p_reason: reason ?? null,
  })
  if (error) throw error
  return data
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
  let receiveItems: Array<{
    variant_id: string
    quantity_received: number
    quantity_damaged?: number
    id?: string
  }> = items ?? []
  // Empty + finalize = short-close (restore shortfall); do not auto-receive remaining.
  if (!receiveItems.length && !finalize) {
    const { data: rows, error: loadErr } = await supabase
      .from('stock_transfer_items')
      .select('id, variant_id, quantity_sent, quantity_received, quantity_damaged')
      .eq('transfer_id', transferId)
      .is('deleted_at', null)
    if (loadErr) throw loadErr
    receiveItems = (rows ?? []).map((r) => {
      const remaining =
        Number(r.quantity_sent) -
        Number(r.quantity_received ?? 0) -
        Number((r as { quantity_damaged?: number | null }).quantity_damaged ?? 0)
      return {
        id: r.id,
        variant_id: r.variant_id,
        quantity_received: Math.max(0, remaining),
      }
    })
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
        quantity_damaged,
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
  cancelTransfer,
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
