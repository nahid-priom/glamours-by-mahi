import { useCallback, useMemo, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { CategoryProductGroup } from '../components/CategoryProductGroup'
import { BarcodePrintDialog, type BarcodePrintItem } from '../components/BarcodePrintDialog'
import { ProductDuplicateDialog } from '../components/ProductDuplicateDialog'
import { ProductEmptyState } from '../components/ProductEmptyState'
import { ProductFilterBar } from '../components/ProductFilterBar'
import { ProductFormDialog } from '../components/ProductFormDialog'
import { ProductInventoryCard } from '../components/ProductInventoryCard'
import { ProductListSkeleton } from '../components/ProductListSkeleton'
import { ProductsPageHeader } from '../components/ProductsPageHeader'
import { CategoryCollapseButton } from '../components/AvailableStockDetails'
import {
  catalogFiltersToListParams,
  clearProductCatalogFilters,
  searchParamsToFilters,
  filtersToSearchParams,
  type ProductCatalogFilters,
} from '../lib/product-filters'
import { buildProductInventoryViewModels } from '../lib/product-list-model'
import {
  listProducts,
  softDeleteProduct,
  type ProductListItem,
} from '../repositories/catalog.repository'
import { invalidateStorefrontCache } from '@/features/storefront/storefront.service'
import { getInventoryStockBreakdown, type InventoryProductStockRow } from '@/features/inventory/repositories/inventory-valuation.repository'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-session'
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
  const { profile } = useAuth()
  const { toast } = useToast()
  const qc = useQueryClient()
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

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.products(listParams),
    queryFn: () => listProducts(listParams),
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

  const { items: viewItems, groups } = useMemo(
    () =>
      buildProductInventoryViewModels(data?.items ?? [], valuationByProduct, filters.sort),
    [data?.items, valuationByProduct, filters.sort],
  )

  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({})
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ProductListItem | null>(null)
  const [duplicateTarget, setDuplicateTarget] = useState<ProductListItem | null>(null)
  const [duplicateOpen, setDuplicateOpen] = useState(false)
  const [barcodeItems, setBarcodeItems] = useState<BarcodePrintItem[]>([])
  const [barcodeOpen, setBarcodeOpen] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: softDeleteProduct,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['products'] })
      invalidateStorefrontCache()
      toast('Product deleted')
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 24))
  const page = filters.page ?? 1

  const openEdit = (row: ProductListItem) => {
    setEditing(row)
    setOpen(true)
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

  const toggleCategory = (categoryId: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [categoryId]: !(prev[categoryId] ?? true),
    }))
  }

  const isCategoryExpanded = (categoryId: string) => collapsedCategories[categoryId] ?? true
  const showInitialLoading = isLoading && !data
  const isEmpty = !showInitialLoading && !error && viewItems.length === 0

  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 space-y-4 px-3 sm:px-4 lg:px-0">
      <ProductsPageHeader
        totalCount={data?.total ?? 0}
        pageCount={viewItems.length}
        isFetching={isFetching && !isLoading}
        onAddProduct={() => {
          setEditing(null)
          setOpen(true)
        }}
      />

      <ProductFilterBar value={filters} onChange={setFilters} />

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
          <div className="space-y-4 lg:hidden">
            {isFetching && data ? (
              <p className="text-xs text-[#9CA3AF]">Refreshing products…</p>
            ) : null}
            {groups.map((group) => (
              <section key={group.categoryId} className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <CategoryCollapseButton
                      expanded={isCategoryExpanded(group.categoryId)}
                      onToggle={() => toggleCategory(group.categoryId)}
                    />
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold text-[#111111]">
                        {group.categoryName}
                      </h2>
                      <p className="text-xs text-[#6B7280]">
                        {formatNumber(group.productCount)} products
                      </p>
                    </div>
                  </div>
                </div>
                {isCategoryExpanded(group.categoryId) ? (
                  <div className="space-y-3">
                    {group.products.map((item) => (
                      <ProductInventoryCard
                        key={item.id}
                        item={item}
                        onEdit={openEdit}
                        onDuplicate={openDuplicate}
                        onPrintBarcode={openBarcode}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                ) : null}
              </section>
            ))}
            {isEmpty ? (
              <ProductEmptyState
                filters={filters}
                variant={filters.category ? 'category' : 'filtered'}
                onClearFilters={() => setFilters(clearProductCatalogFilters())}
              />
            ) : null}
          </div>

          <div className="hidden space-y-4 lg:block">
            {isFetching && data ? (
              <p className="text-xs text-[#9CA3AF]">Refreshing products…</p>
            ) : null}
            {groups.map((group) => (
              <CategoryProductGroup
                key={group.categoryId}
                group={group}
                expanded={isCategoryExpanded(group.categoryId)}
                onToggle={() => toggleCategory(group.categoryId)}
                onEdit={openEdit}
                onDuplicate={openDuplicate}
                onPrintBarcode={openBarcode}
                onDelete={handleDelete}
              />
            ))}
            {isEmpty ? (
              <ProductEmptyState
                filters={filters}
                variant={filters.category ? 'category' : 'filtered'}
                onClearFilters={() => setFilters(clearProductCatalogFilters())}
              />
            ) : null}
          </div>
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

      {profile?.organization_id ? (
        <ProductFormDialog
          open={open}
          onOpenChange={setOpen}
          orgId={profile.organization_id}
          editing={editing}
          onSaved={() => {
            void qc.invalidateQueries({ queryKey: ['products'] })
            invalidateStorefrontCache()
            toast(editing ? 'Product updated' : 'Product created')
          }}
          onError={(m) => toast(m, 'error')}
        />
      ) : null}

      <ProductDuplicateDialog
        open={duplicateOpen}
        onOpenChange={setDuplicateOpen}
        product={duplicateTarget}
        onDuplicated={() => {
          void qc.invalidateQueries({ queryKey: ['products'] })
          toast('Product duplicated')
        }}
        onError={(m) => toast(m, 'error')}
      />

      <BarcodePrintDialog open={barcodeOpen} onOpenChange={setBarcodeOpen} items={barcodeItems} />
    </div>
  )
}
