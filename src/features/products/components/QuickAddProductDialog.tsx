import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { EntityCombobox } from '@/components/entity-combobox'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { kindHasVariants, kindToProductType, type ProductKind } from '@/config/catalog'
import {
  createProductAtomic,
  searchBrands,
  searchCategories,
} from '../repositories/catalog.repository'
import { supabase } from '@/lib/supabase/client'

type UntypedRpc = (
  fn: string,
  args?: object,
) => Promise<{ data: unknown; error: { message: string } | null }>
const untypedRpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgId: string
  branchId: string
  onCreated: (variantId?: string) => void
  onError?: (message: string) => void
}

type FormState = {
  name: string
  category_id: string | null
  brand_id: string | null
  base_barcode: string
  base_sku: string
  purchase_price: string
  selling_price: string
  opening_stock: string
  productKind: ProductKind
}

const INITIAL: FormState = {
  name: '',
  category_id: null,
  brand_id: null,
  base_barcode: '',
  base_sku: '',
  purchase_price: '0',
  selling_price: '0',
  opening_stock: '0',
  productKind: 'simple',
}

export function QuickAddProductDialog({
  open,
  onOpenChange,
  orgId: _orgId,
  branchId,
  onCreated,
  onError,
}: Props) {
  const [form, setForm] = useState<FormState>(INITIAL)

  useEffect(() => {
    if (!open) setForm(INITIAL)
  }, [open])

  const mutation = useMutation({
    mutationFn: async () => {
      const hasVariants = kindHasVariants(form.productKind)
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        category_id: form.category_id,
        brand_id: form.brand_id,
        base_sku: form.base_sku.trim() || null,
        base_barcode: form.base_barcode.trim() || null,
        purchase_price: Number(form.purchase_price) || 0,
        selling_price: Number(form.selling_price) || 0,
        product_type: kindToProductType(form.productKind),
        has_variants: hasVariants,
        status: 'active',
        publish: true,
      }

      if (hasVariants) {
        payload.options = [
          { name: 'Size', values: [{ value: 'M' }] },
          { name: 'Color', values: [{ value: 'Default' }] },
        ]
        payload.variants = [
          {
            size: 'M',
            color: 'Default',
            sku: form.base_sku.trim() || undefined,
            barcode: form.base_barcode.trim() || undefined,
            name: 'M / Default',
            purchase_price: Number(form.purchase_price) || 0,
            selling_price: Number(form.selling_price) || 0,
          },
        ]
      }

      const result = await createProductAtomic(payload)
      const variants = (result?.variants as Array<{ id: string }> | undefined) ?? []
      const variantId = variants[0]?.id

      const openingQty = Number(form.opening_stock) || 0
      if (openingQty > 0 && variantId) {
        const { error } = await untypedRpc('create_opening_stock', {
          payload: {
            branch_id: branchId,
            variant_id: variantId,
            quantity: openingQty,
            unit_cost: Number(form.purchase_price) || 0,
            reference: 'pos_quick_add',
          },
        })
        if (error) throw error
      }

      return variantId
    },
    onSuccess: (variantId) => {
      onCreated(variantId)
      onOpenChange(false)
    },
    onError: (e: Error) => onError?.(e.message),
  })

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Quick add product</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (!form.name.trim()) {
              onError?.('Product name is required')
              return
            }
            mutation.mutate()
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="qa-name">Name *</Label>
            <Input
              id="qa-name"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Product name"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <EntityCombobox
                value={form.category_id}
                onChange={(id) => set({ category_id: id })}
                onSearch={searchCategories}
                placeholder="Category"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Brand</Label>
              <EntityCombobox
                value={form.brand_id}
                onChange={(id) => set({ brand_id: id })}
                onSearch={searchBrands}
                placeholder="Brand"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qa-sku">SKU</Label>
              <Input id="qa-sku" value={form.base_sku} onChange={(e) => set({ base_sku: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qa-barcode">Barcode</Label>
              <Input
                id="qa-barcode"
                value={form.base_barcode}
                onChange={(e) => set({ base_barcode: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qa-purchase">Purchase price</Label>
              <Input
                id="qa-purchase"
                type="number"
                min={0}
                step="0.01"
                value={form.purchase_price}
                onChange={(e) => set({ purchase_price: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qa-selling">Selling price</Label>
              <Input
                id="qa-selling"
                type="number"
                min={0}
                step="0.01"
                value={form.selling_price}
                onChange={(e) => set({ selling_price: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qa-stock">Opening stock</Label>
              <Input
                id="qa-stock"
                type="number"
                min={0}
                step="1"
                value={form.opening_stock}
                onChange={(e) => set({ opening_stock: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qa-kind">Product kind</Label>
              <select
                id="qa-kind"
                className="flex h-10 w-full rounded-xl border border-border bg-white px-3 text-sm"
                value={form.productKind}
                onChange={(e) => set({ productKind: e.target.value as ProductKind })}
              >
                <option value="simple">Simple</option>
                <option value="size_color">Size &amp; color</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
