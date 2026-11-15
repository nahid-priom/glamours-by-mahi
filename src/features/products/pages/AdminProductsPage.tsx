import { useCallback, useMemo, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { BarcodePrintDialog, type BarcodePrintItem } from '../components/BarcodePrintDialog'
import { CategorySidebar } from '../components/CategorySidebar'
import { ProductDuplicateDialog } from '../components/ProductDuplicateDialog'
import { ProductEmptyState } from '../components/ProductEmptyState'
import { ProductFilterBar } from '../components/ProductFilterBar'
import { ProductListPanel } from '../components/ProductListPanel'
import { ProductListSkeleton } from '../components/ProductListSkeleton'
import { ProductsPageHeader } from '../components/ProductsPageHeader'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  catalogFiltersToListParams,
  clearProductCatalogFilters,
  searchParamsToFilters,
  filtersToSearchParams,
  type ProductCatalogFilters,
} from '../lib/product-filters'
import { buildProductInventoryViewModels, UNCATEGORIZED_CATEGORY_ID } from '../lib/product-list-model'
import {
  getCategoryProductCounts,
  listProductsWithInventorySummary,
  softDeleteProduct,
  type ProductListItem,
} from '../repositories/catalog.repository'
import { invalidateStorefrontCache } from '@/features/storefront/storefront.service'
import { getInventoryStockBreakdown, type InventoryProductStockRow } from '@/features/inventory/repositories/inventory-valuation.repository'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { queryKeys } from '@/lib/query/keys'
import { formatNumber } from '@/lib/format'

function productToBarcodeItems(product: ProductListItem): BarcodePrintItem[] {
  const variants = (product.product_variants ?? []).filter((v) => !v.deleted_at)
  if (variants.length === 0) {
    return [
      {
        name: product.name,
        sku: product.base_sku ?? '—',
        barcode: product.base_barcode ?? '',
        price: Number(product.selling_price),
      },
    ]
  }
  return variants.map((v) => ({
    name: product.name,
    sku: v.sku ?? product.base_sku ?? '—',
    barcode: v.barcode ?? product.base_barcode ?? '',
    price: Number(v.selling_price ?? product.selling_price),
    variant: v.name ?? undefined,
  }))
}

export function AdminProductsPage() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const filters: ProductCatalogFilters = useMemo(
    () => searchParamsToFilters(searchParams),
    [searchParams],
  )

  const setFilters = useCallback(
    (next: ProductCatalogFilters) => {
      setSearchParams(filtersToSearchParams(next), { replace: true })
    },
    [setSearchParams],
  )

  const listParams = useMemo(
    () => ({ ...catalogFiltersToListParams(filters), pageSize: 24 }),
    [filters],
  )

  const { data: categoryCounts } = useQuery({
    queryKey: ['category-product-counts'],
    queryFn: getCategoryProductCounts,
  })

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.products(listParams),
    queryFn: () => listProductsWithInventorySummary(listParams),
    placeholderData: keepPreviousData,
  })

  const valuationFilters = useMemo(
    () => ({
      search: listParams.search,
      categoryId: listParams.categoryId,
      brandId: listParams.brandId,
      stockStatus:
        listParams.stockStatus === 'low_stock' || listParams.stockStatus === 'out_of_stock'
          ? listParams.stockStatus
          : null,
      page: listParams.page ?? 1,
      pageSize: 24,
      sortBy:
        listParams.sort === 'value_desc' || listParams.sort === 'value_asc'
          ? ('stock_value' as const)
          : listParams.sort === 'stock_desc' || listParams.sort === 'stock_asc'
            ? ('quantity' as const)
            : undefined,
      sortDirection:
        listParams.sort === 'value_asc' || listParams.sort === 'stock_asc' ? ('asc' as const) : ('desc' as const),
    }),
    [listParams],
  )

  const { data: valuation } = useQuery({
    queryKey: queryKeys.inventoryStockBreakdown(valuationFilters),
    queryFn: () => getInventoryStockBreakdown(valuationFilters),
    enabled: listParams.stockStatus !== 'expiring_soon',
    placeholderData: keepPreviousData,
  })

  const valuationByProduct = useMemo(() => {
    const map = new Map<string, InventoryProductStockRow>()
    for (const row of valuation?.items ?? []) {
      map.set(row.product_id, row)
    }
    return map
  }, [valuation])

  const { items: viewItems } = useMemo(
    () =>
      buildProductInventoryViewModels(data?.items ?? [], valuationByProduct, filters.sort),
    [data?.items, valuationByProduct, filters.sort],
  )

  const [duplicateTarget, setDuplicateTarget] = useState<ProductListItem | null>(null)
  const [duplicateOpen, setDuplicateOpen] = useState(false)
  const [barcodeItems, setBarcodeItems] = useState<BarcodePrintItem[]>([])
  const [barcodeOpen, setBarcodeOpen] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: softDeleteProduct,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['products'] })
      void qc.invalidateQueries({ queryKey: ['category-product-counts'] })
      void qc.invalidateQueries({ queryKey: ['pos-products'] })
      invalidateStorefrontCache()
      toast('Product deleted')
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 24))
  const page = filters.page ?? 1
  const showCategoryBadge = !filters.category

  const handleCategorySelect = (categoryId: string | null) => {
    setFilters({
      ...filters,
      category: categoryId,
      page: 1,
    })
  }

  const openDuplicate = (row: ProductListItem) => {
    setDuplicateTarget(row)
    setDuplicateOpen(true)
  }

  const openBarcode = (row: ProductListItem) => {
    setBarcodeItems(productToBarcodeItems(row))
    setBarcodeOpen(true)
  }

  const handleDelete = (row: ProductListItem) => {
    if (confirm(`Delete “${row.name}”?`)) deleteMutation.mutate(row.id)
  }

  const showInitialLoading = isLoading && !data
  const isEmpty = !showInitialLoading && !error && viewItems.length === 0

  const sidebarSelected = filters.category ?? null

  return (
    <div className="mx-auto w-full max-w-7xl min-w-0 space-y-4 px-3 sm:px-4 lg:px-0">
      <ProductsPageHeader
        totalCount={data?.total ?? 0}
        pageCount={viewItems.length}
        isFetching={isFetching && !isLoading}
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-4 rounded-xl border border-border bg-white p-3">
            {categoryCounts ? (
              <CategorySidebar
                totalCount={categoryCounts.total}
                uncategorizedCount={categoryCounts.uncategorized}
                categories={categoryCounts.categories}
                selected={sidebarSelected}
                onSelect={handleCategorySelect}
              />
            ) : (
              <p className="px-3 text-xs text-[#9CA3AF]">Loading categories…</p>
            )}
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="lg:hidden">
            <LabelledMobileCategory
              categories={categoryCounts?.categories ?? []}
              uncategorizedCount={categoryCounts?.uncategorized ?? 0}
              totalCount={categoryCounts?.total ?? 0}
              selected={sidebarSelected}
              onSelect={handleCategorySelect}
            />
          </div>

          <ProductFilterBar value={filters} onChange={setFilters} hideCategoryFilter />

          {showInitialLoading ? <ProductListSkeleton /> : null}

          {error ? (
            <ProductEmptyState
              filters={filters}
              variant="error"
              onRetry={() => void refetch()}
            />
          ) : null}

          {!showInitialLoading && !error ? (
            <>
              {isFetching && data ? (
                <p className="text-xs text-[#9CA3AF]">Refreshing products…</p>
              ) : null}

              {isEmpty ? (
                <ProductEmptyState
                  filters={filters}
                  variant={filters.category ? 'category' : 'filtered'}
                  onClearFilters={() => setFilters(clearProductCatalogFilters())}
                />
              ) : (
                <ProductListPanel
                  items={viewItems}
                  showCategoryBadge={showCategoryBadge}
                  onEdit={(row) => navigate(`/products/${row.id}/edit`)}
                  onDuplicate={openDuplicate}
                  onPrintBarcode={openBarcode}
                  onDelete={handleDelete}
                />
              )}
            </>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="text-[#6B7280]">
              Page {page}/{totalPages} · showing {formatNumber(viewItems.length)} of{' '}
              {formatNumber(data?.total ?? 0)} products
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setFilters({ ...filters, page: page - 1 })}
              >
                Prev
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setFilters({ ...filters, page: page + 1 })}
              >
                Next
              </Button>
              <Button size="sm" variant="ghost" asChild>
                <Link to="/products/variants">Variants</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ProductDuplicateDialog
        open={duplicateOpen}
        onOpenChange={setDuplicateOpen}
        product={duplicateTarget}
        onDuplicated={() => {
          void qc.invalidateQueries({ queryKey: ['products'] })
          void qc.invalidateQueries({ queryKey: ['category-product-counts'] })
          void qc.invalidateQueries({ queryKey: ['pos-products'] })
          toast('Product duplicated')
        }}
        onError={(m) => toast(m, 'error')}
      />

      <BarcodePrintDialog open={barcodeOpen} onOpenChange={setBarcodeOpen} items={barcodeItems} />
    </div>
  )
}

function LabelledMobileCategory({
  categories,
  uncategorizedCount,
  totalCount,
  selected,
  onSelect,
}: {
  categories: Array<{ categoryId: string; categoryName: string; productCount: number }>
  uncategorizedCount: number
  totalCount: number
  selected: string | null
  onSelect: (id: string | null) => void
}) {
  const value = selected ?? '__all__'

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">Category</p>
      <Select
        value={value}
        onValueChange={(v) => {
          if (v === '__all__') onSelect(null)
          else onSelect(v)
        }}
      >
        <SelectTrigger className="h-11 w-full">
          <SelectValue placeholder="All products" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All products ({formatNumber(totalCount)})</SelectItem>
          {categories.map((cat) => (
            <SelectItem key={cat.categoryId} value={cat.categoryId}>
              {cat.categoryName} ({formatNumber(cat.productCount)})
            </SelectItem>
          ))}
          {uncategorizedCount > 0 ? (
            <SelectItem value={UNCATEGORIZED_CATEGORY_ID}>
              Uncategorized ({formatNumber(uncategorizedCount)})
            </SelectItem>
          ) : null}
        </SelectContent>
      </Select>
    </div>
  )
}
