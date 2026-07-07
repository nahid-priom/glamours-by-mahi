import { Pencil, RotateCcw, Trash2, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatBDT } from '@/lib/format'
import type { Product } from '@/types'
import { EmptyState } from '@/components/shared/EmptyState'

interface ProductTableProps {
  products: Product[]
  onEdit: (product: Product) => void
  onDelete: (product: Product) => void
  onRestore: (product: Product) => void
  onAdjustStock: (product: Product) => void
}

const statusVariant = {
  active: 'success' as const,
  inactive: 'default' as const,
  out_of_stock: 'danger' as const,
}

export function ProductTable({ products, onEdit, onDelete, onRestore, onAdjustStock }: ProductTableProps) {
  if (products.length === 0) {
    return <EmptyState title="No products found" />
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-slate-50 text-left text-xs text-text-muted">
              <th className="px-4 py-3 font-medium sm:px-5">Product</th>
              <th className="px-4 py-3 font-medium sm:px-5">SKU</th>
              <th className="px-4 py-3 font-medium sm:px-5">Price</th>
              <th className="px-4 py-3 font-medium sm:px-5">Stock</th>
              <th className="px-4 py-3 font-medium sm:px-5">Store</th>
              <th className="px-4 py-3 font-medium sm:px-5">Status</th>
              <th className="px-4 py-3 font-medium sm:px-5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className={`border-b border-border/50 hover:bg-slate-50/50 ${p.deleted_at ? 'opacity-60' : ''}`}>
                <td className="px-4 py-3 font-medium sm:px-5">{p.name}</td>
                <td className="px-4 py-3 font-mono text-xs sm:px-5">{p.sku}</td>
                <td className="px-4 py-3 sm:px-5">{formatBDT(p.price)}</td>
                <td className="px-4 py-3 sm:px-5">{p.stock}</td>
                <td className="px-4 py-3 sm:px-5">{p.store_name}</td>
                <td className="px-4 py-3 sm:px-5">
                  <Badge variant={statusVariant[p.status]}>{p.status.replace('_', ' ')}</Badge>
                </td>
                <td className="px-4 py-3 sm:px-5">
                  <div className="flex gap-1">
                    {!p.deleted_at ? (
                      <>
                        <Button variant="blue" size="sm" className="h-7 px-2" onClick={() => onEdit(p)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="warning" size="sm" className="h-7 px-2" onClick={() => onAdjustStock(p)}>
                          <Package className="h-3 w-3" />
                        </Button>
                        <Button variant="danger" size="sm" className="h-7 px-2" onClick={() => onDelete(p)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    ) : (
                      <Button variant="success" size="sm" className="h-7 px-2" onClick={() => onRestore(p)}>
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 p-4 md:hidden">
        {products.map((p) => (
          <div key={p.id} className={`rounded-xl border border-border p-4 ${p.deleted_at ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{p.name}</p>
                <p className="font-mono text-xs text-text-muted">{p.sku}</p>
              </div>
              <Badge variant={statusVariant[p.status]}>{p.status.replace('_', ' ')}</Badge>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <p><span className="text-text-muted">Price:</span> {formatBDT(p.price)}</p>
              <p><span className="text-text-muted">Stock:</span> {p.stock}</p>
              <p className="col-span-2"><span className="text-text-muted">Store:</span> {p.store_name}</p>
            </div>
            <div className="mt-3 flex gap-2">
              {!p.deleted_at ? (
                <>
                  <Button variant="blue" size="sm" onClick={() => onEdit(p)}>Edit</Button>
                  <Button variant="warning" size="sm" onClick={() => onAdjustStock(p)}>Stock</Button>
                  <Button variant="danger" size="sm" onClick={() => onDelete(p)}>Delete</Button>
                </>
              ) : (
                <Button variant="success" size="sm" onClick={() => onRestore(p)}>Restore</Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
