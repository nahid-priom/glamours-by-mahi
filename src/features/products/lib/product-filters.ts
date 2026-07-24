export type ProductLifecycleStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'active'
  | 'inactive'
  | 'rejected'
  | 'archived'

export type ProductStockChip =
  | 'all'
  | 'drafts'
  | 'pending'
  | 'low_stock'
  | 'out_of_stock'
  | 'expiring_soon'
  | 'inactive'

export type ProductCatalogSort =
  | 'recently_added'
  | 'name_asc'
  | 'stock_desc'
  | 'stock_asc'
  | 'value_desc'
  | 'value_asc'

/** URL-friendly filter object for product catalog views */
export type ProductCatalogFilters = {
  q?: string
  category?: string | null
  brand?: string | null
  status?: ProductLifecycleStatus | 'all'
  stock?: ProductStockChip
  sort?: ProductCatalogSort
  page?: number
}

export const SORT_OPTIONS: Array<{ value: ProductCatalogSort; label: string }> = [
  { value: 'recently_added', label: 'Recently added' },
  { value: 'name_asc', label: 'Name A–Z' },
  { value: 'stock_desc', label: 'Highest stock' },
  { value: 'stock_asc', label: 'Lowest stock' },
  { value: 'value_desc', label: 'Highest value' },
  { value: 'value_asc', label: 'Lowest value' },
]

export const STOCK_CHIP_OPTIONS: Array<{ value: ProductStockChip; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'drafts', label: 'Drafts' },
  { value: 'pending', label: 'Pending' },
  { value: 'low_stock', label: 'Low Stock' },
  { value: 'out_of_stock', label: 'Out of Stock' },
  { value: 'expiring_soon', label: 'Expiring Soon' },
  { value: 'inactive', label: 'Inactive' },
]

export const STATUS_OPTIONS: Array<{ value: ProductLifecycleStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_approval', label: 'Pending approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'archived', label: 'Archived' },
]

export function filtersToSearchParams(filters: ProductCatalogFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.q?.trim()) params.set('q', filters.q.trim())
  if (filters.category) params.set('category', filters.category)
  if (filters.brand) params.set('brand', filters.brand)
  if (filters.status && filters.status !== 'all') params.set('status', filters.status)
  if (filters.stock && filters.stock !== 'all') params.set('stock', filters.stock)
  if (filters.sort && filters.sort !== 'name_asc') params.set('sort', filters.sort)
  if (filters.page && filters.page > 1) params.set('page', String(filters.page))
  return params
}

export function searchParamsToFilters(params: URLSearchParams): ProductCatalogFilters {
  const stock = params.get('stock') as ProductStockChip | null
  const statusParam = params.get('status')
  const status =
    statusParam && statusParam !== 'all'
      ? (statusParam as ProductLifecycleStatus)
      : 'all'
  const sortParam = params.get('sort') as ProductCatalogSort | null
  const validSort = SORT_OPTIONS.some((opt) => opt.value === sortParam)

  return {
    q: params.get('q') ?? '',
    category: params.get('category'),
    brand: params.get('brand'),
    status,
    stock: stock && stock !== 'all' ? stock : 'all',
    sort: validSort ? sortParam! : 'name_asc',
    page: Math.max(1, Number(params.get('page') ?? 1) || 1),
  }
}

export function catalogFiltersToListParams(filters: ProductCatalogFilters) {
  let status = filters.status && filters.status !== 'all' ? filters.status : undefined
  let stockStatus = filters.stock && filters.stock !== 'all' ? filters.stock : undefined

  if (stockStatus === 'drafts') {
    status = 'draft'
    stockStatus = undefined
  } else if (stockStatus === 'pending') {
    status = 'pending_approval'
    stockStatus = undefined
  } else if (stockStatus === 'inactive') {
    status = 'inactive'
    stockStatus = undefined
  }

  return {
    search: filters.q,
    categoryId: filters.category,
    brandId: filters.brand,
    status,
    stockStatus,
    sort: filters.sort ?? 'name_asc',
    page: filters.page ?? 1,
  }
}

export function clearProductCatalogFilters(): ProductCatalogFilters {
  return {
    q: '',
    category: null,
    brand: null,
    status: 'all',
    stock: 'all',
    sort: 'name_asc',
    page: 1,
  }
}
