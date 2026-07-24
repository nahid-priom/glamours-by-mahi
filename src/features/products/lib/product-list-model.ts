import { formatBDT, formatNumber } from '@/lib/format'
import type { InventoryProductStockRow } from '@/features/inventory/repositories/inventory-valuation.repository'
import type { ProductListItem } from '../repositories/catalog.repository'
import type { ProductCatalogSort } from './product-filters'

export const UNCATEGORIZED_CATEGORY_ID = '__uncategorized__'

export type ProductInventoryViewModel = {
  id: string
  raw: ProductListItem
  name: string
  sku: string | null
  brandName: string | null
  coverUrl: string | null
  categoryId: string
  categoryName: string
  variantCount: number
  unit: string
  priceLabel: string
  availableStock: number
  onHand: number
  reserved: number
  stockStatus: string
  lifecycleStatus: string
  stockValue: number | null
  unitCost: number | null
  hasCostConfigured: boolean
  createdAt: string
}

export type CategoryProductGroupModel = {
  categoryId: string
  categoryName: string
  products: ProductInventoryViewModel[]
  productCount: number
  totalAvailable: number
  totalStockValue: number
}

function resolveLifecycleStatus(product: ProductListItem): string {
  return product.status ?? (product.is_active ? 'active' : 'inactive')
}

function resolveStockStatus(
  stock: InventoryProductStockRow | undefined,
  fallbackQty: number,
): string {
  if (stock?.stock_status) return stock.stock_status
  if (fallbackQty < 0) return 'negative_stock'
  if (fallbackQty <= 0) return 'out_of_stock'
  return 'in_stock'
}

function computePriceRange(product: ProductListItem): { min: number; max: number } {
  const variants = (product.product_variants ?? []).filter((v) => !v.deleted_at)
  const prices = variants
    .map((v) => Number(v.selling_price ?? product.selling_price))
    .filter((p) => Number.isFinite(p) && p >= 0)

  if (prices.length === 0) {
    const base = Number(product.selling_price) || 0
    return { min: base, max: base }
  }

  return { min: Math.min(...prices), max: Math.max(...prices) }
}

export function formatProductPriceLabel(product: ProductListItem): string {
  const { min, max } = computePriceRange(product)
  if (min === max) return formatBDT(min)
  return `${formatBDT(min)}–${formatBDT(max)}`
}

export function formatVariantCountLabel(count: number): string {
  if (count <= 0) return 'No variants'
  if (count === 1) return '1 variant'
  return `${formatNumber(count)} variants`
}

export function normalizeProductInventoryItem(
  product: ProductListItem,
  stock: InventoryProductStockRow | undefined,
): ProductInventoryViewModel {
  const fallbackQty = product.totalStock ?? 0
  const onHand = stock?.total_quantity ?? fallbackQty
  const reserved = stock?.reserved_quantity ?? 0
  const availableStock = stock?.available_quantity ?? fallbackQty
  const categoryId = product.categories?.id ?? UNCATEGORIZED_CATEGORY_ID
  const categoryName = product.categories?.name ?? 'Uncategorized'

  return {
    id: product.id,
    raw: product,
    name: product.name,
    sku: product.base_sku ?? null,
    brandName: product.brands?.name ?? null,
    coverUrl: product.coverUrl ?? null,
    categoryId,
    categoryName,
    variantCount: product.variantCount ?? 0,
    unit: product.unit?.trim() || 'pcs',
    priceLabel: formatProductPriceLabel(product),
    availableStock,
    onHand,
    reserved,
    stockStatus: resolveStockStatus(stock, availableStock),
    lifecycleStatus: resolveLifecycleStatus(product),
    stockValue: stock?.total_stock_value ?? null,
    unitCost: stock?.average_unit_cost ?? null,
    hasCostConfigured:
      stock?.average_unit_cost != null ||
      stock?.total_purchase_cost != null ||
      Number(product.purchase_price) > 0,
    createdAt: product.created_at,
  }
}

export function sortProductInventoryItems(
  items: ProductInventoryViewModel[],
  sort: ProductCatalogSort | undefined,
): ProductInventoryViewModel[] {
  const sorted = [...items]
  switch (sort) {
    case 'recently_added':
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      break
    case 'stock_desc':
      sorted.sort((a, b) => b.availableStock - a.availableStock)
      break
    case 'stock_asc':
      sorted.sort((a, b) => a.availableStock - b.availableStock)
      break
    case 'value_desc':
      sorted.sort((a, b) => (b.stockValue ?? 0) - (a.stockValue ?? 0))
      break
    case 'value_asc':
      sorted.sort((a, b) => (a.stockValue ?? 0) - (b.stockValue ?? 0))
      break
    case 'name_asc':
    default:
      sorted.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
      break
  }
  return sorted
}

export function groupProductsByCategory(
  items: ProductInventoryViewModel[],
): CategoryProductGroupModel[] {
  const groups = new Map<string, CategoryProductGroupModel>()

  for (const item of items) {
    const existing = groups.get(item.categoryId)
    if (existing) {
      existing.products.push(item)
      existing.productCount += 1
      existing.totalAvailable += item.availableStock
      existing.totalStockValue += item.stockValue ?? 0
      continue
    }

    groups.set(item.categoryId, {
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      products: [item],
      productCount: 1,
      totalAvailable: item.availableStock,
      totalStockValue: item.stockValue ?? 0,
    })
  }

  return [...groups.values()].sort((a, b) => {
    if (a.categoryId === UNCATEGORIZED_CATEGORY_ID) return 1
    if (b.categoryId === UNCATEGORIZED_CATEGORY_ID) return -1
    return a.categoryName.localeCompare(b.categoryName, undefined, { sensitivity: 'base' })
  })
}

export function buildProductInventoryViewModels(
  products: ProductListItem[],
  valuationByProduct: Map<string, InventoryProductStockRow>,
  sort?: ProductCatalogSort,
): { items: ProductInventoryViewModel[]; groups: CategoryProductGroupModel[] } {
  const normalized = products.map((product) =>
    normalizeProductInventoryItem(product, valuationByProduct.get(product.id)),
  )
  const items = sortProductInventoryItems(normalized, sort)
  const groups = groupProductsByCategory(items)
  return { items, groups }
}

export function countActiveFilters(filters: {
  q?: string
  category?: string | null
  brand?: string | null
  status?: string
  stock?: string
}): number {
  let count = 0
  if (filters.q?.trim()) count += 1
  if (filters.category) count += 1
  if (filters.brand) count += 1
  if (filters.status && filters.status !== 'all') count += 1
  if (filters.stock && filters.stock !== 'all') count += 1
  return count
}
