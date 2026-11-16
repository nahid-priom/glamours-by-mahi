import { supabase } from '@/lib/supabase/client'

export type SupplierStockFilters = {
  branchId?: string | null
  supplierId?: string | null
  search?: string
  categoryId?: string | null
  brandId?: string | null
  stockStatus?: string | null
  includeNonSaleable?: boolean
  receiptFrom?: string | null
  receiptTo?: string | null
  sourceStatus?: string | null
  page?: number
  pageSize?: number
  sortBy?: string
  sortDirection?: 'asc' | 'desc'
}

export type SupplierStockKpis = {
  suppliers_with_stock: number
  total_received_quantity: number
  remaining_on_hand: number
  available_quantity: number
  remaining_stock_cost: number | null
  potential_selling_value: number
  potential_gross_profit: number | null
  low_stock_count: number
  out_of_stock_count: number
  unknown_source_quantity: number
  can_view_cost: boolean
  as_of_supported: boolean
}

export type SupplierStockSummaryRow = {
  supplier_id: string | null
  supplier_key: string
  supplier_name: string
  supplier_code: string | null
  product_count: number
  variant_count: number
  received_qty: number
  remaining_qty: number
  available_qty: number
  stock_cost: number | null
  selling_value: number
  potential_profit: number | null
  low_stock_count: number
  out_of_stock_count: number
  last_purchase_at: string | null
}

function num(v: unknown): number {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

async function untypedRpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await (supabase as unknown as {
    rpc: (fn: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }>
  }).rpc(name, args)
  if (error) throw error
  return data
}

export async function getSupplierStockKpis(
  filters: SupplierStockFilters = {},
): Promise<SupplierStockKpis> {
  const data = (await untypedRpc('get_supplier_stock_kpis', {
    p_branch_id: filters.branchId ?? undefined,
    p_supplier_id: filters.supplierId ?? undefined,
    p_search: filters.search?.trim() || undefined,
    p_category_id: filters.categoryId ?? undefined,
    p_brand_id: filters.brandId ?? undefined,
    p_stock_status: filters.stockStatus ?? undefined,
    p_include_non_saleable: filters.includeNonSaleable ?? false,
    p_receipt_from: filters.receiptFrom ?? undefined,
    p_receipt_to: filters.receiptTo ?? undefined,
    p_source_status: filters.sourceStatus ?? undefined,
  })) as Record<string, unknown>

  return {
    suppliers_with_stock: num(data.suppliers_with_stock),
    total_received_quantity: num(data.total_received_quantity),
    remaining_on_hand: num(data.remaining_on_hand),
    available_quantity: num(data.available_quantity),
    remaining_stock_cost:
      data.remaining_stock_cost == null ? null : num(data.remaining_stock_cost),
    potential_selling_value: num(data.potential_selling_value),
    potential_gross_profit:
      data.potential_gross_profit == null ? null : num(data.potential_gross_profit),
    low_stock_count: num(data.low_stock_count),
    out_of_stock_count: num(data.out_of_stock_count),
    unknown_source_quantity: num(data.unknown_source_quantity),
    can_view_cost: Boolean(data.can_view_cost),
    as_of_supported: Boolean(data.as_of_supported),
  }
}

export async function getSupplierStockSummary(
  filters: SupplierStockFilters = {},
): Promise<{
  total_count: number
  page: number
  page_size: number
  can_view_cost: boolean
  items: SupplierStockSummaryRow[]
}> {
  const data = (await untypedRpc('get_supplier_stock_summary', {
    p_branch_id: filters.branchId ?? undefined,
    p_supplier_id: filters.supplierId ?? undefined,
    p_search: filters.search?.trim() || undefined,
    p_category_id: filters.categoryId ?? undefined,
    p_brand_id: filters.brandId ?? undefined,
    p_stock_status: filters.stockStatus ?? undefined,
    p_include_non_saleable: filters.includeNonSaleable ?? false,
    p_receipt_from: filters.receiptFrom ?? undefined,
    p_receipt_to: filters.receiptTo ?? undefined,
    p_source_status: filters.sourceStatus ?? undefined,
    p_page: filters.page ?? 1,
    p_page_size: filters.pageSize ?? 20,
    p_sort_by: filters.sortBy ?? 'remaining',
    p_sort_direction: filters.sortDirection ?? 'desc',
  })) as Record<string, unknown>

  const items = ((data.items as Array<Record<string, unknown>>) ?? []).map((row) => ({
    supplier_id: (row.supplier_id as string | null) ?? null,
    supplier_key: String(row.supplier_key ?? ''),
    supplier_name: String(row.supplier_name ?? 'Unknown / Unattributed'),
    supplier_code: (row.supplier_code as string | null) ?? null,
    product_count: num(row.product_count),
    variant_count: num(row.variant_count),
    received_qty: num(row.received_qty),
    remaining_qty: num(row.remaining_qty),
    available_qty: num(row.available_qty),
    stock_cost: row.stock_cost == null ? null : num(row.stock_cost),
    selling_value: num(row.selling_value),
    potential_profit: row.potential_profit == null ? null : num(row.potential_profit),
    low_stock_count: num(row.low_stock_count),
    out_of_stock_count: num(row.out_of_stock_count),
    last_purchase_at: (row.last_purchase_at as string | null) ?? null,
  }))

  return {
    total_count: num(data.total_count),
    page: num(data.page) || 1,
    page_size: num(data.page_size) || 20,
    can_view_cost: Boolean(data.can_view_cost),
    items,
  }
}

export async function getSupplierStockBreakdown(params: {
  supplierId?: string | null
  supplierUnknown?: boolean
  branchId?: string | null
  includeNonSaleable?: boolean
  level?: string
}) {
  const data = (await untypedRpc('get_supplier_stock_breakdown', {
    p_supplier_id: params.supplierId ?? undefined,
    p_supplier_unknown: params.supplierUnknown ?? false,
    p_branch_id: params.branchId ?? undefined,
    p_include_non_saleable: params.includeNonSaleable ?? false,
    p_level: params.level ?? 'products',
  })) as Record<string, unknown>

  return {
    can_view_cost: Boolean(data.can_view_cost),
    items: (data.items as Array<Record<string, unknown>>) ?? [],
    variants: (data.variants as Array<Record<string, unknown>>) ?? [],
    branches: (data.branches as Array<Record<string, unknown>>) ?? [],
    sources: (data.sources as Array<Record<string, unknown>>) ?? [],
  }
}

export async function getSupplierStockMovements(params: {
  supplierId?: string | null
  supplierUnknown?: boolean
  branchId?: string | null
  page?: number
  pageSize?: number
}) {
  const data = (await untypedRpc('get_supplier_stock_movements', {
    p_supplier_id: params.supplierId ?? undefined,
    p_supplier_unknown: params.supplierUnknown ?? false,
    p_branch_id: params.branchId ?? undefined,
    p_page: params.page ?? 1,
    p_page_size: params.pageSize ?? 50,
  })) as Record<string, unknown>

  return {
    total_count: num(data.total_count),
    page: num(data.page) || 1,
    page_size: num(data.page_size) || 50,
    items: (data.items as Array<Record<string, unknown>>) ?? [],
  }
}
