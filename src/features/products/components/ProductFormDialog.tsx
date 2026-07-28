import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ProductForm } from './ProductForm'
import type { ProductListItem } from '../repositories/catalog.repository'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgId: string
  editing: ProductListItem | null
  onSaved: (productId: string) => void
  onError: (message: string) => void
}

/** @deprecated Use dedicated /products/new and /products/:id/edit pages */
export function ProductFormDialog({ open, onOpenChange, orgId, editing, onSaved, onError }: Props) {
  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto p-0">
        <ProductForm
          orgId={orgId}
          editing={editing}
          title={editing ? 'Edit product' : 'Add new product'}
          onSaved={(id) => {
            onSaved(id)
            onOpenChange(false)
          }}
          onError={onError}
        />
      </DialogContent>
    </Dialog>
  )
}
