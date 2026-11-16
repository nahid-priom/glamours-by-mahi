import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useToast } from '@/components/ui/toast'
import { productsService } from './products.service'
import { ProductFormDialog } from './ProductFormDialog'
import { ProductFiltersBar } from './components/ProductFilters'
import { ProductTable } from './components/ProductTable'
import type { Product } from '@/types'
import type { ProductFormInput, ProductStatus } from './products.types'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toastRpcError } from '@/lib/errors/rpc-error'

export function ProductsPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [store, setStore] = useState('all')
  const [status, setStatus] = useState<ProductStatus | 'all'>('all')
  const [showDeleted, setShowDeleted] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [stockTarget, setStockTarget] = useState<Product | null>(null)
  const [stockDelta, setStockDelta] = useState(0)

  const filters = useMemo(
    () => ({ search, store, status, include_deleted: showDeleted }),
    [search, store, status, showDeleted],
  )

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', filters],
    queryFn: () => productsService.getProducts(filters),
  })

  const { data: stats } = useQuery({
    queryKey: ['products', 'stats'],
    queryFn: () => productsService.getStats(),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['products'] })

  const createMutation = useMutation({
    mutationFn: (data: ProductFormInput) => productsService.createProduct(data),
    onSuccess: () => { invalidate(); toast('Product created successfully') },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProductFormInput }) =>
      productsService.updateProduct(id, data),
    onSuccess: () => { invalidate(); toast('Product updated') },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productsService.softDelete(id),
    onSuccess: () => { invalidate(); toast('Product archived'); setDeleteTarget(null) },
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => productsService.restore(id),
    onSuccess: () => { invalidate(); toast('Product restored') },
  })

  const stockMutation = useMutation({
    mutationFn: ({ id, delta }: { id: string; delta: number }) =>
      productsService.adjustStock(id, delta),
    onSuccess: () => { invalidate(); toast('Stock updated'); setStockTarget(null) },
  })

  const handleFormSubmit = async (data: ProductFormInput) => {
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, data })
    } else {
      await createMutation.mutateAsync(data)
    }
    setEditing(null)
  }

  const kpis = [
    { label: 'Total Products', value: stats?.total ?? 0 },
    { label: 'Active', value: stats?.active ?? 0, color: 'text-success' },
    { label: 'Low Stock', value: stats?.low_stock ?? 0, color: 'text-warning' },
    { label: 'Out of Stock', value: stats?.out_of_stock ?? 0, color: 'text-danger' },
  ]

  return (
    <PageShell
      title="Products"
      description="Inventory control across all stores"
      actions={
        <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
          <Plus className="h-4 w-4" />
          Add Product
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="text-center">
              <p className="text-xs text-text-muted">{k.label}</p>
              <p className={cn('mt-1 text-lg font-bold', k.color)}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <ProductFiltersBar
        search={search}
        onSearchChange={setSearch}
        store={store}
        status={status}
        showDeleted={showDeleted}
        onStoreChange={setStore}
        onStatusChange={setStatus}
        onShowDeletedChange={setShowDeleted}
      />

      <Card>
        <CardContent className="overflow-hidden p-0">
          {isLoading ? (
            <LoadingSkeleton />
          ) : (
            <ProductTable
              products={products ?? []}
              onEdit={(p) => { setEditing(p); setFormOpen(true) }}
              onDelete={setDeleteTarget}
              onRestore={(p) => restoreMutation.mutate(p.id)}
              onAdjustStock={(p) => { setStockTarget(p); setStockDelta(0) }}
            />
          )}
        </CardContent>
      </Card>

      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editing}
        onSubmit={handleFormSubmit}
        loading={createMutation.isPending || updateMutation.isPending}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Archive Product"
        description={`Archive "${deleteTarget?.name}"? It will be hidden from the catalog.`}
        confirmLabel="Archive"
        variant="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />

      <Dialog open={!!stockTarget} onOpenChange={() => setStockTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adjust Stock — {stockTarget?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-text-muted">Current stock: {stockTarget?.stock}</p>
          <div className="space-y-1.5">
            <Label>Adjustment (+/-)</Label>
            <Input
              type="number"
              value={stockDelta}
              onChange={(e) => setStockDelta(Number(e.target.value))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockTarget(null)}>Cancel</Button>
            <Button
              onClick={() => stockTarget && stockMutation.mutate({ id: stockTarget.id, delta: stockDelta })}
              disabled={stockMutation.isPending}
            >
              Update Stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
