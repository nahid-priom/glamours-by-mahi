import { useCallback, useMemo, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { Copy, Loader2, Plus, Printer, Upload } from 'lucide-react'
import { AppImage } from '@/components/common/AppImage'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { useAuth } from '@/features/auth/auth-session'
import { MoneyValue } from '@/features/inventory/components/InventoryValuationUi'
import { StockStatusBadge } from '@/features/inventory/components/StockStatusBadge'
import { getInventoryStockBreakdown, type InventoryProductStockRow } from '@/features/inventory/repositories/inventory-valuation.repository'
import { formatBDT } from '@/lib/format'
import { queryKeys } from '@/lib/query/keys'
import { BarcodePrintDialog, type BarcodePrintItem } from '../components/BarcodePrintDialog'
import { ProductDuplicateDialog } from '../components/ProductDuplicateDialog'
import { ProductFilterBar } from '../components/ProductFilterBar'
import { ProductFormDialog } from '../components/ProductFormDialog'
import { ProductMobileCard } from '../components/ProductMobileCard'
import { ProductStatusBadge } from '../components/ProductStatusBadge'
import {
  catalogFiltersToListParams,
  searchParamsToFilters,
  filtersToSearchParams,
  type ProductCatalogFilters,
} from '../lib/product-filters'
import {
  listProducts,
  softDeleteProduct,
  type ProductListItem,
} from '../repositories/catalog.repository'
import { invalidateStorefrontCache } from '@/features/storefront/storefront.service'

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
  const { profile, can } = useAuth()
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

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.products(listParams),
    queryFn: () => listProducts(listParams),
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

  const canViewCost =
    valuation?.can_view_cost ??
    (can('inventory.valuation') || can('accounting.view') || can('products.manage_prices'))

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

  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#111111]">Products</h1>
          <p className="text-sm text-[#6B7280]">Admin catalog backed by Supabase.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PermissionGate permission="products.import">
            <Button size="sm" variant="outline" asChild>
              <Link to="/products/import">
                <Upload className="mr-1.5 h-4 w-4" />
                Import
              </Link>
            </Button>
          </PermissionGate>
          <PermissionGate permission="products.create">
            <Button
              size="sm"
              onClick={() => {
                setEditing(null)
                setOpen(true)
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Add product
            </Button>
          </PermissionGate>
        </div>
      </div>

      <ProductFilterBar value={filters} onChange={setFilters} />

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-[#6B7280]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading products…
        </div>
      ) : null}
      {error ? <p className="text-sm text-[#E11D48]">Failed to load products.</p> : null}

      <div className="space-y-3 md:hidden">
        {(data?.items ?? []).map((row) => (
          <ProductMobileCard
            key={row.id}
            product={row}
            onEdit={openEdit}
            onDuplicate={openDuplicate}
            onPrintBarcode={openBarcode}
          />
        ))}
        {!isLoading && (data?.items.length ?? 0) === 0 ? (
          <p className="py-8 text-center text-sm text-[#6B7280]">No products found.</p>
        ) : null}
      </div>

      <div className="hidden rounded-xl border border-border bg-white md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14" />
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Variants</TableHead>
              <TableHead>Price</TableHead>
              <TableHead className="text-right">On hand</TableHead>
              <TableHead className="text-right">Avail.</TableHead>
              {canViewCost ? <TableHead className="text-right">Stock cost</TableHead> : null}
              <TableHead className="text-right">Stock value</TableHead>
              <TableHead>Stock status</TableHead>
              <TableHead>Lifecycle</TableHead>
              <TableHead className="w-36" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.items ?? []).map((row) => {
              const stock = valuationByProduct.get(row.id)
              return (
              <TableRow key={row.id}>
                <TableCell>
                  <AppImage
                    src={row.coverUrl}
                    alt={row.name}
                    className="h-10 w-10 rounded-md"
                    aspectRatio="square"
                  />
                </TableCell>
                <TableCell>
                  <p className="font-medium">{row.name}</p>
                  <p className="text-xs text-[#9CA3AF]">{row.base_sku ?? '—'}</p>
                </TableCell>
                <TableCell className="text-[#6B7280]">{row.categories?.name ?? '—'}</TableCell>
                <TableCell className="text-[#6B7280]">{row.brands?.name ?? '—'}</TableCell>
                <TableCell className="text-[#6B7280]">{row.variantCount ?? 0}</TableCell>
                <TableCell>{formatBDT(Number(row.selling_price))}</TableCell>
                <TableCell className="text-right font-medium">
                  {stock?.total_quantity ?? row.totalStock ?? 0}
                </TableCell>
                <TableCell className="text-right text-[#6B7280]">
                  {stock?.available_quantity ?? row.totalStock ?? 0}
                </TableCell>
                {canViewCost ? (
                  <TableCell className="text-right">
                    <MoneyValue amount={stock?.total_purchase_cost} />
                  </TableCell>
                ) : null}
                <TableCell className="text-right">
                  <MoneyValue amount={stock?.total_stock_value ?? 0} />
                </TableCell>
                <TableCell>
                  <StockStatusBadge
                    status={stock?.stock_status ?? ((row.totalStock ?? 0) > 0 ? 'in_stock' : 'out_of_stock')}
                  />
                </TableCell>
                <TableCell>
                  <ProductStatusBadge status={row.status ?? (row.is_active ? 'active' : 'inactive')} />
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <PermissionGate permission="products.update">
                      <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                        Edit
                      </Button>
                    </PermissionGate>
                    <PermissionGate permission="products.create">
                      <Button size="sm" variant="ghost" title="Duplicate" onClick={() => openDuplicate(row)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </PermissionGate>
                    <Button size="sm" variant="ghost" title="Print barcode" onClick={() => openBarcode(row)}>
                      <Printer className="h-4 w-4" />
                    </Button>
                    <PermissionGate permission="products.update">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-[#E11D48]"
                        onClick={() => {
                          if (confirm(`Delete “${row.name}”?`)) deleteMutation.mutate(row.id)
                        }}
                      >
                        Delete
                      </Button>
                    </PermissionGate>
                  </div>
                </TableCell>
              </TableRow>
            )})}
          </TableBody>
        </Table>
        {!isLoading && (data?.items.length ?? 0) === 0 ? (
          <p className="p-6 text-center text-sm text-[#6B7280]">No products found.</p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 text-sm">
        <p className="text-[#6B7280]">
          {data?.total ?? 0} products · page {page}/{totalPages}
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
