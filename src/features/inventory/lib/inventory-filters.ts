import type { InventoryValuationFilters } from '../repositories/inventory-valuation.repository'

export type InventoryView = 'branches' | 'products' | 'variants' | 'suppliers' | 'low-stock'

export type InventoryStockStatusFilter =
  | 'all'
  | 'in_stock'
  | 'low_stock'
  | 'out_of_stock'
  | 'negative_stock'
  | 'in_transit'
  | 'damaged'
  | 'quarantine'

export type InventorySortBy =
  | 'stock_value'
  | 'quantity'
  | 'product_name'
  | 'purchase_cost'
  | 'profit'

export type InventoryPageFilters = InventoryValuationFilters & {
  view: InventoryView
  page: number
  sortBy: InventorySortBy
  sortDirection: 'asc' | 'desc'
  includeDamaged: boolean
  includeQuarantine: boolean
  supplierId?: string | null
  receiptFrom?: string | null
  receiptTo?: string | null
  sourceStatus?: 'verified' | 'system_allocated' | 'unknown_legacy' | null
}

export const INVENTORY_VIEWS: Array<{ value: InventoryView; label: string }> = [
  { value: 'branches', label: 'Branch Summary' },
  { value: 'products', label: 'Product Stock' },
  { value: 'variants', label: 'Variant Stock' },
  { value: 'suppliers', label: 'Supplier Stock' },
  { value: 'low-stock', label: 'Low Stock' },
]

/** Statuses supported by valuation RPCs (no overstock — no max_stock column). */
export const STOCK_STATUS_FILTER_OPTIONS: Array<{
  value: InventoryStockStatusFilter
  label: string
}> = [
  { value: 'all', label: 'All Stock' },
  { value: 'in_stock', label: 'In Stock' },
  { value: 'low_stock', label: 'Low Stock' },
  { value: 'out_of_stock', label: 'Out of Stock' },
  { value: 'negative_stock', label: 'Negative Stock' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'quarantine', label: 'Quarantine' },
]

const SUPPORTED_STATUSES = new Set(
  STOCK_STATUS_FILTER_OPTIONS.map((o) => o.value).filter((v) => v !== 'all'),
)

/** Branch summary only honors non-saleable include flags today. */
export function statusOptionsForView(view: InventoryView): typeof STOCK_STATUS_FILTER_OPTIONS {
  if (view === 'branches') {
    return STOCK_STATUS_FILTER_OPTIONS.filter((o) => o.value === 'all')
  }
  if (view === 'low-stock') {
    return STOCK_STATUS_FILTER_OPTIONS.filter((o) =>
      ['all', 'low_stock', 'out_of_stock'].includes(o.value),
    )
  }
  return STOCK_STATUS_FILTER_OPTIONS
}

export const SORT_OPTIONS: Array<{ value: InventorySortBy; label: string }> = [
  { value: 'stock_value', label: 'Stock Value' },
  { value: 'quantity', label: 'Quantity' },
  { value: 'product_name', label: 'Product Name' },
  { value: 'purchase_cost', label: 'Stock Cost' },
  { value: 'profit', label: 'Potential Profit' },
]

export function filtersFromSearchParams(params: URLSearchParams): InventoryPageFilters {
  const view = (params.get('view') as InventoryView) || 'branches'
  const validView = INVENTORY_VIEWS.some((v) => v.value === view) ? view : 'branches'
  const statusRaw = (params.get('status') as InventoryStockStatusFilter) || 'all'
  const status =
    statusRaw === 'all' || !SUPPORTED_STATUSES.has(statusRaw) ? 'all' : statusRaw
  const sort = (params.get('sort') as InventorySortBy) || 'stock_value'
  const allowedStatuses = new Set(statusOptionsForView(validView).map((o) => o.value))
  const stockStatus =
    status !== 'all' && allowedStatuses.has(status)
      ? (status as InventoryValuationFilters['stockStatus'])
      : null

  const sourceStatusRaw = params.get('sourceStatus')
  const sourceStatus =
    sourceStatusRaw === 'verified' ||
    sourceStatusRaw === 'system_allocated' ||
    sourceStatusRaw === 'unknown_legacy'
      ? sourceStatusRaw
      : null

  return {
    view: validView,
    branchId: params.get('branch') === 'all' || !params.get('branch') ? null : params.get('branch'),
    locationId: params.get('location') || null,
    search: params.get('q') || undefined,
    categoryId: params.get('category') || null,
    brandId: params.get('brand') || null,
    stockStatus,
    includeNonSaleable:
      params.get('damaged') === '1' ||
      params.get('quarantine') === '1' ||
      params.get('allLocations') === '1' ||
      stockStatus === 'damaged' ||
      stockStatus === 'quarantine',
    includeDamaged: params.get('damaged') === '1' || stockStatus === 'damaged',
    includeQuarantine: params.get('quarantine') === '1' || stockStatus === 'quarantine',
    supplierId: params.get('supplier') || null,
    receiptFrom: params.get('receiptFrom') || null,
    receiptTo: params.get('receiptTo') || null,
    sourceStatus,
    page: Math.max(1, Number(params.get('page') ?? 1) || 1),
    sortBy: SORT_OPTIONS.some((o) => o.value === sort) ? sort : 'stock_value',
    sortDirection: params.get('sortDir') === 'asc' ? 'asc' : 'desc',
  }
}

export function filtersToSearchParams(filters: InventoryPageFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.view && filters.view !== 'branches') params.set('view', filters.view)
  if (filters.branchId) params.set('branch', filters.branchId)
  else params.set('branch', 'all')
  if (filters.search?.trim()) params.set('q', filters.search.trim())
  if (filters.stockStatus) params.set('status', filters.stockStatus)
  if (filters.categoryId) params.set('category', filters.categoryId)
  if (filters.brandId) params.set('brand', filters.brandId)
  if (filters.locationId) params.set('location', filters.locationId)
  if (filters.includeDamaged) params.set('damaged', '1')
  if (filters.includeQuarantine) params.set('quarantine', '1')
  if (filters.supplierId) params.set('supplier', filters.supplierId)
  if (filters.receiptFrom) params.set('receiptFrom', filters.receiptFrom)
  if (filters.receiptTo) params.set('receiptTo', filters.receiptTo)
  if (filters.sourceStatus) params.set('sourceStatus', filters.sourceStatus)
  if (filters.sortBy !== 'stock_value') params.set('sort', filters.sortBy)
  if (filters.sortDirection === 'asc') params.set('sortDir', 'asc')
  if (filters.page > 1) params.set('page', String(filters.page))
  return params
}

export function clearInventoryFilters(): InventoryPageFilters {
  return {
    view: 'branches',
    branchId: null,
    locationId: null,
    search: undefined,
    categoryId: null,
    brandId: null,
    stockStatus: null,
    includeNonSaleable: false,
    includeDamaged: false,
    includeQuarantine: false,
    supplierId: null,
    receiptFrom: null,
    receiptTo: null,
    sourceStatus: null,
    page: 1,
    sortBy: 'stock_value',
    sortDirection: 'desc',
  }
}

export function countActiveInventoryFilters(filters: InventoryPageFilters): number {
  let count = 0
  if (filters.search?.trim()) count += 1
  if (filters.branchId) count += 1
  if (filters.stockStatus) count += 1
  if (filters.categoryId) count += 1
  if (filters.brandId) count += 1
  if (filters.locationId) count += 1
  if (filters.includeDamaged) count += 1
  if (filters.includeQuarantine) count += 1
  if (filters.supplierId) count += 1
  if (filters.receiptFrom) count += 1
  if (filters.receiptTo) count += 1
  if (filters.sourceStatus) count += 1
  return count
}

export function toSupplierStockFilters(filters: InventoryPageFilters) {
  return {
    branchId: filters.branchId,
    supplierId: filters.supplierId,
    search: filters.search,
    categoryId: filters.categoryId,
    brandId: filters.brandId,
    stockStatus: filters.stockStatus,
    includeNonSaleable: filters.includeNonSaleable,
    receiptFrom: filters.receiptFrom,
    receiptTo: filters.receiptTo,
    sourceStatus: filters.sourceStatus,
    page: filters.page,
    pageSize: 20,
    sortBy: filters.sortBy === 'stock_value' ? 'remaining' : filters.sortBy,
    sortDirection: filters.sortDirection,
  }
}

export function toValuationFilters(filters: InventoryPageFilters): InventoryValuationFilters {
  return {
    branchId: filters.branchId,
    locationId: filters.locationId,
    search: filters.search,
    categoryId: filters.categoryId,
    brandId: filters.brandId,
    stockStatus: filters.stockStatus,
    includeNonSaleable: filters.includeNonSaleable,
  }
}
