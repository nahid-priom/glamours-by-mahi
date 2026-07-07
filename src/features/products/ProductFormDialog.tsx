import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MOCK_STORES } from '@/lib/mock-data'
import type { Product } from '@/types'
import type { ProductFormInput } from './products.types'

const schema = z.object({
  name: z.string().min(2, 'Name is required'),
  sku: z.string().min(2, 'SKU is required'),
  store_id: z.string().min(1, 'Store is required'),
  price: z.number().min(0),
  stock: z.number().int().min(0),
  status: z.enum(['active', 'inactive', 'out_of_stock']),
})

interface ProductFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: Product | null
  onSubmit: (data: ProductFormInput) => Promise<void>
  loading?: boolean
}

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
  onSubmit,
  loading,
}: ProductFormDialogProps) {
  const form = useForm<ProductFormInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      sku: '',
      store_id: '',
      price: 0,
      stock: 0,
      status: 'active',
    },
  })

  useEffect(() => {
    if (product) {
      form.reset({
        name: product.name,
        sku: product.sku,
        store_id: product.store_id,
        price: product.price,
        stock: product.stock,
        status: product.status,
      })
    } else {
      form.reset({ name: '', sku: '', store_id: '', price: 0, stock: 0, status: 'active' })
    }
  }, [product, open, form])

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit(data)
    onOpenChange(false)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{product ? 'Edit Product' : 'Add Product'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Product Name</Label>
            <Input {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-xs text-danger">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>SKU</Label>
            <Input {...form.register('sku')} />
            {form.formState.errors.sku && (
              <p className="text-xs text-danger">{form.formState.errors.sku.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Store</Label>
            <Select value={form.watch('store_id')} onValueChange={(v) => form.setValue('store_id', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select store" />
              </SelectTrigger>
              <SelectContent>
                {MOCK_STORES.filter((s) => s.status === 'active').map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Price (৳)</Label>
              <Input type="number" {...form.register('price', { valueAsNumber: true })} />
            </div>
            <div className="space-y-1.5">
              <Label>Stock</Label>
              <Input type="number" {...form.register('stock', { valueAsNumber: true })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={form.watch('status')}
              onValueChange={(v) => form.setValue('status', v as ProductFormInput['status'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="out_of_stock">Out of Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {product ? 'Save Changes' : 'Add Product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
