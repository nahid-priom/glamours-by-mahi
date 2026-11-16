import { supabase } from '@/lib/supabase/client'

type UntypedRpc = (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>

const untypedRpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc

export type InventoryStockStatus =
  | 'in_stock'
  | 'low_stock'
  | 'out_of_stock'
  | 'negative_stock'
  | 'in_transit'
  | 'damaged'
  | 'quarantine'

export type InventoryValuationFilters = {
  branchId?: string | null
  locationId?: string | null
  search?: string
  categoryId?: string | null
  brandId?: string | null
  stockStatus?: InventoryStockStatus | null
  includeNonSaleable?: boolean
}

export type InventoryValuationSummary = {
  total_products: number
  total_variants: number
  total_stock_quantity: number
  total_stock_purchase_cost: number | null
  total_stock_value: number
  potential_gross_profit: number | null
  low_stock_variants: number
  out_of_stock_variants: number
  last_movement_at: string | null
  valuation_fallback_count: number
}

export type InventoryBranchSummaryRow = {
  branch_id: string
  branch_name: string
  branch_code: string | null
  is_head_office: boolean
  total_products: number
  total_variants: number
  total_stock_quantity: number
  total_stock_purchase_cost: number | null
  total_stock_value: number
  potential_gross_profit: number | null
  low_stock_count: number
  out_of_stock_count: number
  last_movement_at: string | null
}

export type InventoryProductStockRow = {
  product_id: string
  product_name: string
  product_code: string | null
  product_type: string
  category: string | null
  brand: string | null
  variant_count: number
  total_quantity: number
  reserved_quantity: number
  available_quantity: number
  damaged_quantity?: number
  quarantine_quantity?: number
  in_transit_quantity?: number
  incoming_quantity?: number
  average_unit_cost: number | null
  total_purchase_cost: number | null
  effective_selling_price: number
  total_stock_value: number
  potential_profit: number | null
  reorder_level: number
  stock_status: string
  branch_count: number
  last_stock_movement_at: string | null
  cost_is_fallback?: boolean | null
}

export type InventoryStockBreakdownResult = {
  total_count: number
  page: number
  page_size: number
  can_view_cost: boolean
  items: InventoryProductStockRow[]
  export_scope?: string
}

export type InventoryVariantStockRow = {
  row_key: string
  variant_id: string
  product_id: string
  product_name: string
  variant_name: string | null
  sku: string | null
  barcode: string | null
  branch_id: string
  branch_name: string
  location_name: string | null
  location_type: string | null
  on_hand: number
  reserved_quantity: number
  available_quantity: number
  damaged_quantity: number
  quarantine_quantity: number
  in_transit_quantity: number
  incoming_quantity: number
  reorder_level: number
  stock_status: string
  shortage: number
}

export type InventoryVariantBreakdownResult = {
  total_count: number
  page: number
  page_size: number
  can_view_cost: boolean
  items: InventoryVariantStockRow[]
}

export type InventoryLowStockRow = {
  row_key: string
  variant_id: string
  product_id: string
  product_name: string
  variant_name: string | null
  sku: string | null
  barcode: string | null
  branch_id: string
  branch_name: string
  available_quantity: number
  reorder_level: number
  shortage: number
  stock_status: string
}

export type InventoryLowStockResult = {
  total_count: number
  page: number
  page_size: number
  can_view_cost: boolean
  items: InventoryLowStockRow[]
}

export type AccessibleBranch = {
  id: string
  name: string
  code: string | null
  is_central: boolean
}

export type PaginatedInventoryFilters = InventoryValuationFilters & {
  page?: number
  pageSize?: number
  sortBy?: 'stock_value' | 'quantity' | 'product_name' | 'purchase_cost' | 'profit'
  sortDirection?: 'asc' | 'desc'
}

function num(value: unknown): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function mapSummary(row: Record<string, unknown>): InventoryValuationSummary {
  return {
    total_products: num(row.total_products),
    total_variants: num(row.total_variants),
    total_stock_quantity: num(row.total_stock_quantity),
    total_stock_purchase_cost:
      row.total_stock_purchase_cost == null ? null : num(row.total_stock_purchase_cost),
    total_stock_value: num(row.total_stock_value),
    potential_gross_profit:
      row.potential_gross_profit == null ? null : num(row.potential_gross_profit),
    low_stock_variants: num(row.low_stock_variants),
    out_of_stock_variants: num(row.out_of_stock_variants),
    last_movement_at: (row.last_movement_at as string | null) ?? null,
    valuation_fallback_count: num(row.valuation_fallback_count),
  }
}

function mapProductRow(row: Record<string, unknown>): InventoryProductStockRow {
  return {
    product_id: String(row.product_id),
    product_name: String(row.product_name ?? ''),
    product_code: (row.product_code as string | null) ?? null,
    product_type: String(row.product_type ?? ''),
    category: (row.category as string | null) ?? null,
    brand: (row.brand_name as string | null) ?? (row.brand as string | null) ?? null,
    variant_count: num(row.variant_count),
    total_quantity: num(row.total_quantity ?? row.on_hand),
    reserved_quantity: num(row.reserved_quantity),
    available_quantity: num(row.available_quantity),
    damaged_quantity: num(row.damaged_quantity),
    quarantine_quantity: num(row.quarantine_quantity),
    in_transit_quantity: num(row.in_transit_quantity),
    incoming_quantity: num(row.incoming_quantity),
    average_unit_cost: row.average_unit_cost == null ? null : num(row.average_unit_cost),
    total_purchase_cost: row.total_purchase_cost == null ? null : num(row.total_purchase_cost),
    effective_selling_price: num(row.effective_selling_price),
    total_stock_value: num(row.total_stock_value),
    potential_profit: row.potential_profit == null ? null : num(row.potential_profit),
    reorder_level: num(row.reorder_level),
    stock_status: String(row.stock_status ?? row.inventory_status ?? 'in_stock'),
    branch_count: num(row.branch_count),
    last_stock_movement_at: (row.last_stock_movement_at as string | null) ?? null,
    cost_is_fallback: row.cost_is_fallback == null ? null : Boolean(row.cost_is_fallback),
  }
}

function rpcFilterArgs(filters: PaginatedInventoryFilters) {
  return {
    p_branch_id: filters.branchId ?? undefined,
    p_location_id: filters.locationId ?? undefined,
    p_search: filters.search?.trim() || undefined,
    p_category_id: filters.categoryId ?? undefined,
    p_brand_id: filters.brandId ?? undefined,
    p_stock_status: filters.stockStatus ?? undefined,
    p_page: filters.page ?? 1,
    p_page_size: filters.pageSize ?? 20,
    p_sort_by: filters.sortBy ?? 'stock_value',
    p_sort_direction: filters.sortDirection ?? 'desc',
    p_include_non_saleable: filters.includeNonSaleable ?? false,
  }
}

export async function listAccessibleBranches(): Promise<AccessibleBranch[]> {
  const { data, error } = await supabase
    .from('branches')
    .select('id, name, code, is_central')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('is_central', { ascending: false })
    .order('name')
  if (error) throw error
  return (data ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    code: b.code,
    is_central: Boolean(b.is_central),
  }))
}

export async function getInventoryValuationSummary(
  filters: InventoryValuationFilters = {},
): Promise<InventoryValuationSummary> {
  const { data, error } = await supabase.rpc('get_inventory_valuation_summary', {
    p_branch_id: filters.branchId ?? undefined,
    p_location_id: filters.locationId ?? undefined,
    p_search: filters.search?.trim() || undefined,
    p_category_id: filters.categoryId ?? undefined,
    p_brand_id: filters.brandId ?? undefined,
    p_stock_status: filters.stockStatus ?? undefined,
    p_include_non_saleable: filters.includeNonSaleable ?? false,
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return mapSummary((row ?? {}) as Record<string, unknown>)
}

export async function getInventoryBranchSummary(
  includeNonSaleable = false,
): Promise<InventoryBranchSummaryRow[]> {
  const { data, error } = await supabase.rpc('get_inventory_branch_summary', {
    p_include_non_saleable: includeNonSaleable,
  })
  if (error) throw error
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    branch_id: String(row.branch_id),
    branch_name: String(row.branch_name ?? ''),
    branch_code: (row.branch_code as string | null) ?? null,
    is_head_office: Boolean(row.is_head_office),
    total_products: num(row.total_products),
    total_variants: num(row.total_variants),
    total_stock_quantity: num(row.total_stock_quantity),
    total_stock_purchase_cost:
      row.total_stock_purchase_cost == null ? null : num(row.total_stock_purchase_cost),
    total_stock_value: num(row.total_stock_value),
    potential_gross_profit:
      row.potential_gross_profit == null ? null : num(row.potential_gross_profit),
    low_stock_count: num(row.low_stock_count),
    out_of_stock_count: num(row.out_of_stock_count),
    last_movement_at: (row.last_movement_at as string | null) ?? null,
  }))
}

export async function getInventoryStockBreakdown(
  filters: PaginatedInventoryFilters = {},
): Promise<InventoryStockBreakdownResult> {
  const { data, error } = await supabase.rpc('get_inventory_stock_breakdown', rpcFilterArgs(filters))
  if (error) throw error

  const payload = (data ?? {}) as Record<string, unknown>
  return {
    total_count: num(payload.total_count),
    page: num(payload.page) || 1,
    page_size: num(payload.page_size) || 20,
    can_view_cost: Boolean(payload.can_view_cost),
    items: ((payload.items as Array<Record<string, unknown>>) ?? []).map(mapProductRow),
    export_scope: (payload.export_scope as string | undefined) ?? undefined,
  }
}

export async function getInventoryVariantBreakdown(
  filters: PaginatedInventoryFilters = {},
): Promise<InventoryVariantBreakdownResult> {
  const { data, error } = await untypedRpc('get_inventory_variant_breakdown', {
    ...rpcFilterArgs({ ...filters, sortBy: filters.sortBy ?? 'quantity', sortDirection: filters.sortDirection ?? 'asc' }),
  })
  if (error) throw error
  const payload = (data ?? {}) as Record<string, unknown>
  return {
    total_count: num(payload.total_count),
    page: num(payload.page) || 1,
    page_size: num(payload.page_size) || 20,
    can_view_cost: Boolean(payload.can_view_cost),
    items: ((payload.items as Array<Record<string, unknown>>) ?? []).map((row) => ({
      row_key: String(row.row_key),
      variant_id: String(row.variant_id),
      product_id: String(row.product_id),
      product_name: String(row.product_name ?? ''),
      variant_name: (row.variant_name as string | null) ?? null,
      sku: (row.sku as string | null) ?? null,
      barcode: (row.barcode as string | null) ?? null,
      branch_id: String(row.branch_id),
      branch_name: String(row.branch_name ?? ''),
      location_name: (row.location_name as string | null) ?? null,
      location_type: (row.location_type as string | null) ?? null,
      on_hand: num(row.on_hand),
      reserved_quantity: num(row.reserved_quantity),
      available_quantity: num(row.available_quantity),
      damaged_quantity: num(row.damaged_quantity),
      quarantine_quantity: num(row.quarantine_quantity),
      in_transit_quantity: num(row.in_transit_quantity),
      incoming_quantity: num(row.incoming_quantity),
      reorder_level: num(row.reorder_level),
      stock_status: String(row.stock_status ?? 'in_stock'),
      shortage: num(row.shortage),
    })),
  }
}

export async function getInventoryLowStock(
  filters: PaginatedInventoryFilters = {},
): Promise<InventoryLowStockResult> {
  const { data, error } = await untypedRpc('get_inventory_low_stock', {
    ...rpcFilterArgs({
      ...filters,
      sortBy: filters.sortBy ?? 'quantity',
      sortDirection: filters.sortDirection ?? 'asc',
    }),
  })
  if (error) throw error
  const payload = (data ?? {}) as Record<string, unknown>
  return {
    total_count: num(payload.total_count),
    page: num(payload.page) || 1,
    page_size: num(payload.page_size) || 20,
    can_view_cost: Boolean(payload.can_view_cost),
    items: ((payload.items as Array<Record<string, unknown>>) ?? []).map((row) => ({
      row_key: String(row.row_key),
      variant_id: String(row.variant_id),
      product_id: String(row.product_id),
      product_name: String(row.product_name ?? ''),
      variant_name: (row.variant_name as string | null) ?? null,
      sku: (row.sku as string | null) ?? null,
      barcode: (row.barcode as string | null) ?? null,
      branch_id: String(row.branch_id),
      branch_name: String(row.branch_name ?? ''),
      available_quantity: num(row.available_quantity),
      reorder_level: num(row.reorder_level),
      shortage: num(row.shortage),
      stock_status: String(row.stock_status ?? 'low_stock'),
    })),
  }
}

export async function exportInventoryStock(
  filters: InventoryValuationFilters & {
    scope?: 'page' | 'filtered'
    page?: number
    pageSize?: number
  } = {},
): Promise<InventoryStockBreakdownResult> {
  const { data, error } = await untypedRpc('export_inventory_stock', {
    p_branch_id: filters.branchId ?? undefined,
    p_location_id: filters.locationId ?? undefined,
    p_search: filters.search?.trim() || undefined,
    p_category_id: filters.categoryId ?? undefined,
    p_brand_id: filters.brandId ?? undefined,
    p_stock_status: filters.stockStatus ?? undefined,
    p_include_non_saleable: filters.includeNonSaleable ?? false,
    p_scope: filters.scope ?? 'filtered',
    p_page: filters.page ?? 1,
    p_page_size: filters.pageSize ?? 20,
  })
  if (error) throw error
  const payload = (data ?? {}) as Record<string, unknown>
  return {
    total_count: num(payload.total_count),
    page: num(payload.page) || 1,
    page_size: num(payload.page_size) || 20,
    can_view_cost: Boolean(payload.can_view_cost),
    items: ((payload.items as Array<Record<string, unknown>>) ?? []).map(mapProductRow),
    export_scope: (payload.export_scope as string | undefined) ?? filters.scope,
  }
}

export async function seedInventoryPresence(
  items: Array<{ variant_id: string; branch_id: string; location_id?: string | null }>,
): Promise<{ seeded: number }> {
  if (items.length === 0) return { seeded: 0 }
  const { data, error } = await untypedRpc('seed_inventory_presence', {
    payload: { items },
  })
  if (error) throw error
  const result = (data ?? {}) as Record<string, unknown>
  return { seeded: num(result.seeded) }
}

export const inventoryValuationRepository = {
  listAccessibleBranches,
  getInventoryValuationSummary,
  getInventoryBranchSummary,
  getInventoryStockBreakdown,
  getInventoryVariantBreakdown,
  getInventoryLowStock,
  exportInventoryStock,
  seedInventoryPresence,
}
