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
import { ProductKpiCards } from '../components/ProductKpiCards'
import { ProductStatusTabs } from '../components/ProductStatusTabs'
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
  getProductCatalogKpis,
  listProductsWithInventorySummary,
  softDeleteProduct,
  transitionProductStatus,
  type ProductListItem,
} from '../repositories/catalog.repository'
import { invalidateInventoryQueries } from '@/features/inventory/lib/invalidate-inventory-queries'
import { invalidateStorefrontCache } from '@/features/storefront/storefront.service'
import { getInventoryStockBreakdown, type InventoryProductStockRow } from '@/features/inventory/repositories/inventory-valuation.repository'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { queryKeys } from '@/lib/query/keys'
import { formatNumber } from '@/lib/format'
import { useAuth } from '@/features/auth/auth-session'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { toastRpcError } from '@/lib/errors/rpc-error'

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
  const { can, activeBranchId } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

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

  const branchScope = activeBranchId ?? 'all'

  const listParams = useMemo(
    () => ({
      ...catalogFiltersToListParams(filters),
      pageSize: 24,
      branchId: activeBranchId ?? null,
    }),
    [filters, activeBranchId],
  )

  const { data: categoryCounts } = useQuery({
    queryKey: ['category-product-counts'],
    queryFn: getCategoryProductCounts,
  })

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['product-catalog-kpis', branchScope],
    queryFn: getProductCatalogKpis,
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
      branchId: activeBranchId ?? null,
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
    [listParams, activeBranchId],
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
      invalidateInventoryQueries(qc)
      void qc.invalidateQueries({ queryKey: ['category-product-counts'] })
      invalidateStorefrontCache()
      toast('Product deleted')
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  const bulkStatusMutation = useMutation({
    mutationFn: async (status: 'active' | 'archived') => {
      const ids = Array.from(selectedIds)
      for (const product_id of ids) {
        await transitionProductStatus({
          product_id,
          status,
          publish: status === 'active' ? false : undefined,
        })
      }
      return { count: ids.length, status }
    },
    onSuccess: ({ count, status }) => {
      setSelectedIds(new Set())
      invalidateInventoryQueries(qc)
      invalidateStorefrontCache()
      toast(`${count} product(s) marked ${status}`)
    },
    onError: (e: Error) => toastRpcError(toast, e),
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

  const openBulkBarcode = () => {
    const selected = viewItems.filter((i) => selectedIds.has(i.id)).map((i) => i.raw)
    const source = selected.length > 0 ? selected : viewItems.map((i) => i.raw)
    const items = source.flatMap(productToBarcodeItems).filter((i) => i.barcode)
    if (items.length === 0) {
      toast('No barcodes available to print', 'error')
      return
    }
    setBarcodeItems(items)
    setBarcodeOpen(true)
  }

  const exportCsv = () => {
    const rows = viewItems.map((i) => ({
      name: i.name,
      sku: i.sku ?? '',
      type: i.productTypeLabel,
      category: i.categoryName,
      brand: i.brandName ?? '',
      variants: i.variantCount,
      stock: i.availableStock,
      price: i.priceLabel,
      status: i.lifecycleStatus,
    }))
    const header = Object.keys(rows[0] ?? { name: '' })
    const csv = [
      header.join(','),
      ...rows.map((r) =>
        header.map((h) => `"${String((r as Record<string, unknown>)[h] ?? '').replace(/"/g, '""')}"`).join(','),
      ),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'products-export.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDelete = (row: ProductListItem) => {
    if (confirm(`Delete “${row.name}”?`)) deleteMutation.mutate(row.id)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (viewItems.length > 0 && viewItems.every((i) => prev.has(i.id))) return new Set()
      return new Set(viewItems.map((i) => i.id))
    })
  }

  const showInitialLoading = isLoading && !data
  const isEmpty = !showInitialLoading && !error && viewItems.length === 0

  const sidebarSelected = filters.category ?? null

  return (
    <div className="mx-auto w-full max-w-7xl min-w-0 space-y-4 px-3 sm:px-4 lg:px-0">
      <ProductsPageHeader onPrintBarcodes={openBulkBarcode} onExport={exportCsv} />

      <p className="text-xs text-[#6B7280]">
        {activeBranchId
          ? 'Stock badges show quantities for the active branch selected in the header.'
          : 'All Branches selected — stock badges show organization-wide totals (reporting only).'}
      </p>

      <ProductKpiCards
        kpis={kpis}
        loading={kpisLoading}
        showValue={can('inventory.read') || can('reports.read') || can('products.approve')}
      />

      <ProductStatusTabs filters={filters} onChange={setFilters} />

      {selectedIds.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#FECDD3] bg-[#FFF1F2] px-3 py-2 text-sm">
          <span className="font-medium text-[#9F1239]">{selectedIds.size} selected</span>
          <PermissionGate permission="products.approve">
            <Button
              size="sm"
              variant="outline"
              disabled={bulkStatusMutation.isPending}
              onClick={() => bulkStatusMutation.mutate('active')}
            >
              Bulk Activate
            </Button>
          </PermissionGate>
          <PermissionGate permission="products.update">
            <Button
              size="sm"
              variant="outline"
              disabled={bulkStatusMutation.isPending}
              onClick={() => bulkStatusMutation.mutate('archived')}
            >
              Bulk Archive
            </Button>
          </PermissionGate>
          <Button size="sm" variant="outline" onClick={openBulkBarcode}>
            Print Barcodes
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            Clear
          </Button>
        </div>
      ) : null}

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
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                  onToggleSelectAll={toggleSelectAll}
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
          invalidateInventoryQueries(qc)
          void qc.invalidateQueries({ queryKey: ['category-product-counts'] })
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
