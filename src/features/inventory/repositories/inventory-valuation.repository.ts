import { supabase } from '@/lib/supabase/client'

export type InventoryValuationFilters = {
  branchId?: string | null
  locationId?: string | null
  search?: string
  categoryId?: string | null
  brandId?: string | null
  stockStatus?: 'in_stock' | 'low_stock' | 'out_of_stock' | null
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
  average_unit_cost: number | null
  total_purchase_cost: number | null
  effective_selling_price: number
  total_stock_value: number
  potential_profit: number | null
  reorder_level: number
  stock_status: string
  branch_count: number
  last_stock_movement_at: string | null
}

export type InventoryStockBreakdownResult = {
  total_count: number
  page: number
  page_size: number
  can_view_cost: boolean
  items: InventoryProductStockRow[]
}

export type AccessibleBranch = {
  id: string
  name: string
  code: string | null
  is_central: boolean
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
  filters: InventoryValuationFilters & {
    page?: number
    pageSize?: number
    sortBy?: 'stock_value' | 'quantity' | 'product_name' | 'purchase_cost' | 'profit'
    sortDirection?: 'asc' | 'desc'
  } = {},
): Promise<InventoryStockBreakdownResult> {
  const { data, error } = await supabase.rpc('get_inventory_stock_breakdown', {
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
  })
  if (error) throw error

  const payload = (data ?? {}) as Record<string, unknown>
  const items = ((payload.items as Array<Record<string, unknown>>) ?? []).map((row) => ({
    product_id: String(row.product_id),
    product_name: String(row.product_name ?? ''),
    product_code: (row.product_code as string | null) ?? null,
    product_type: String(row.product_type ?? ''),
    category: (row.category as string | null) ?? null,
    brand: (row.brand_name as string | null) ?? (row.brand as string | null) ?? null,
    variant_count: num(row.variant_count),
    total_quantity: num(row.total_quantity),
    reserved_quantity: num(row.reserved_quantity),
    available_quantity: num(row.available_quantity),
    average_unit_cost: row.average_unit_cost == null ? null : num(row.average_unit_cost),
    total_purchase_cost: row.total_purchase_cost == null ? null : num(row.total_purchase_cost),
    effective_selling_price: num(row.effective_selling_price),
    total_stock_value: num(row.total_stock_value),
    potential_profit: row.potential_profit == null ? null : num(row.potential_profit),
    reorder_level: num(row.reorder_level),
    stock_status: String(row.stock_status ?? 'in_stock'),
    branch_count: num(row.branch_count),
    last_stock_movement_at: (row.last_stock_movement_at as string | null) ?? null,
  }))

  return {
    total_count: num(payload.total_count),
    page: num(payload.page) || 1,
    page_size: num(payload.page_size) || 20,
    can_view_cost: Boolean(payload.can_view_cost),
    items,
  }
}

export const inventoryValuationRepository = {
  listAccessibleBranches,
  getInventoryValuationSummary,
  getInventoryBranchSummary,
  getInventoryStockBreakdown,
}
