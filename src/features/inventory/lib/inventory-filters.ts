import type { InventoryValuationFilters } from '../repositories/inventory-valuation.repository'

export type InventoryView = 'branches' | 'products' | 'variants' | 'low-stock'

export type InventoryStockStatusFilter =
  | 'all'
  | 'in_stock'
  | 'low_stock'
  | 'out_of_stock'
  | 'negative_stock'
  | 'overstock'
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
}

export const INVENTORY_VIEWS: Array<{ value: InventoryView; label: string }> = [
  { value: 'branches', label: 'Branch Summary' },
  { value: 'products', label: 'Product Stock' },
  { value: 'variants', label: 'Variant Stock' },
  { value: 'low-stock', label: 'Low Stock' },
]

export const STOCK_STATUS_FILTER_OPTIONS: Array<{ value: InventoryStockStatusFilter; label: string }> = [
  { value: 'all', label: 'All Stock' },
  { value: 'in_stock', label: 'In Stock' },
  { value: 'low_stock', label: 'Low Stock' },
  { value: 'out_of_stock', label: 'Out of Stock' },
  { value: 'negative_stock', label: 'Negative Stock' },
  { value: 'overstock', label: 'Overstock' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'quarantine', label: 'Quarantine' },
]

export const SORT_OPTIONS: Array<{ value: InventorySortBy; label: string }> = [
  { value: 'stock_value', label: 'Stock Value' },
  { value: 'quantity', label: 'Quantity' },
  { value: 'product_name', label: 'Product Name' },
  { value: 'purchase_cost', label: 'Stock Cost' },
  { value: 'profit', label: 'Potential Profit' },
]

const RPC_STOCK_STATUSES = new Set(['in_stock', 'low_stock', 'out_of_stock'])

export function filtersFromSearchParams(params: URLSearchParams): InventoryPageFilters {
  const view = (params.get('view') as InventoryView) || 'branches'
  const validView = INVENTORY_VIEWS.some((v) => v.value === view) ? view : 'branches'
  const status = (params.get('status') as InventoryStockStatusFilter) || 'all'
  const sort = (params.get('sort') as InventorySortBy) || 'stock_value'

  return {
    view: validView,
    branchId: params.get('branch') === 'all' || !params.get('branch') ? null : params.get('branch'),
    locationId: params.get('location') || null,
    search: params.get('q') || undefined,
    categoryId: params.get('category') || null,
    brandId: params.get('brand') || null,
    stockStatus: RPC_STOCK_STATUSES.has(status) ? (status as InventoryValuationFilters['stockStatus']) : null,
    includeNonSaleable:
      params.get('damaged') === '1' ||
      params.get('quarantine') === '1' ||
      params.get('allLocations') === '1',
    includeDamaged: params.get('damaged') === '1',
    includeQuarantine: params.get('quarantine') === '1',
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
  return count
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
