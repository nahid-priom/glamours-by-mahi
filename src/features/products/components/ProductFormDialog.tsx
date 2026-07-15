import { useCallback, useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { EntityCombobox } from '@/components/entity-combobox'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ProductImageUploader } from '../components/ProductImageUploader'
import {
  createProduct,
  searchBrands,
  searchCategories,
  searchSubcategories,
  updateProduct,
  type ProductInput,
  type ProductListItem,
} from '../repositories/catalog.repository'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgId: string
  editing: ProductListItem | null
  onSaved: (productId: string) => void
  onError: (message: string) => void
}

type FormState = {
  name: string
  description: string
  category_id: string | null
  subcategory_id: string | null
  brand_id: string | null
  base_sku: string
  base_barcode: string
  purchase_price: string
  selling_price: string
  wholesale_price: string
  reorder_level: string
  is_active: boolean
  has_variants: boolean
}

function toForm(p: ProductListItem | null): FormState {
  if (!p) {
    return {
      name: '',
      description: '',
      category_id: null,
      subcategory_id: null,
      brand_id: null,
      base_sku: '',
      base_barcode: '',
      purchase_price: '0',
      selling_price: '0',
      wholesale_price: '',
      reorder_level: '0',
      is_active: true,
      has_variants: false,
    }
  }
  return {
    name: p.name,
    description: p.description ?? '',
    category_id: p.category_id,
    subcategory_id: p.subcategory_id,
    brand_id: p.brand_id,
    base_sku: p.base_sku ?? '',
    base_barcode: p.base_barcode ?? '',
    purchase_price: String(p.purchase_price),
    selling_price: String(p.selling_price),
    wholesale_price: p.wholesale_price != null ? String(p.wholesale_price) : '',
    reorder_level: String(p.reorder_level),
    is_active: p.is_active,
    has_variants: p.has_variants,
  }
}

export function ProductFormDialog({ open, onOpenChange, orgId, editing, onSaved, onError }: Props) {
  const [form, setForm] = useState<FormState>(() => toForm(editing))
  const [createdId, setCreatedId] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setForm(toForm(editing))
      setCreatedId(editing?.id ?? null)
    }
  }, [open, editing])

  const onSearchCategories = useCallback((q: string) => searchCategories(q), [])
  const onSearchBrands = useCallback((q: string) => searchBrands(q), [])
  const onSearchSubcategories = useCallback(
    (q: string) => searchSubcategories(q, form.category_id),
    [form.category_id],
  )

  const saveMutation = useMutation({
    mutationFn: async () => {
      const input: ProductInput = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        category_id: form.category_id,
        subcategory_id: form.subcategory_id,
        brand_id: form.brand_id,
        base_sku: form.base_sku.trim() || null,
        base_barcode: form.base_barcode.trim() || null,
        purchase_price: Number(form.purchase_price) || 0,
        selling_price: Number(form.selling_price) || 0,
        wholesale_price: form.wholesale_price ? Number(form.wholesale_price) : null,
        reorder_level: Number(form.reorder_level) || 0,
        is_active: form.is_active,
        has_variants: form.has_variants,
      }
      if (editing) {
        await updateProduct(editing.id, input)
        return editing.id
      }
      if (createdId) {
        await updateProduct(createdId, input)
        return createdId
      }
      const row = await createProduct(orgId, input)
      setCreatedId(row.id)
      return row.id
    },
    onSuccess: (id) => onSaved(id),
    onError: (e: Error) => onError(e.message),
  })

  const productId = editing?.id ?? createdId

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit product' : 'New product'}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            saveMutation.mutate()
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="prod-name">Name</Label>
            <Input
              id="prod-name"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <EntityCombobox
                value={form.category_id}
                onChange={(id) =>
                  setForm((f) => ({ ...f, category_id: id, subcategory_id: null }))
                }
                onSearch={onSearchCategories}
                placeholder="Category"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Subcategory</Label>
              <EntityCombobox
                value={form.subcategory_id}
                onChange={(id) => setForm((f) => ({ ...f, subcategory_id: id }))}
                onSearch={onSearchSubcategories}
                placeholder="Subcategory"
                disabled={!form.category_id}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Brand</Label>
            <EntityCombobox
              value={form.brand_id}
              onChange={(id) => setForm((f) => ({ ...f, brand_id: id }))}
              onSearch={onSearchBrands}
              placeholder="Brand"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="prod-sku">Base SKU</Label>
              <Input
                id="prod-sku"
                value={form.base_sku}
                onChange={(e) => setForm((f) => ({ ...f, base_sku: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prod-barcode">Barcode</Label>
              <Input
                id="prod-barcode"
                value={form.base_barcode}
                onChange={(e) => setForm((f) => ({ ...f, base_barcode: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="prod-cost">Cost</Label>
              <Input
                id="prod-cost"
                type="number"
                min={0}
                step="0.01"
                value={form.purchase_price}
                onChange={(e) => setForm((f) => ({ ...f, purchase_price: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prod-price">Price</Label>
              <Input
                id="prod-price"
                type="number"
                min={0}
                step="0.01"
                value={form.selling_price}
                onChange={(e) => setForm((f) => ({ ...f, selling_price: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prod-reorder">Reorder</Label>
              <Input
                id="prod-reorder"
                type="number"
                min={0}
                value={form.reorder_level}
                onChange={(e) => setForm((f) => ({ ...f, reorder_level: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              />
              Active
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.has_variants}
                onChange={(e) => setForm((f) => ({ ...f, has_variants: e.target.checked }))}
              />
              Has variants
            </label>
          </div>
          {productId ? (
            <div className="space-y-1.5">
              <Label>Cover image</Label>
              <ProductImageUploader
                orgId={orgId}
                productId={productId}
                currentUrl={editing?.coverUrl}
              />
            </div>
          ) : (
            <p className="text-xs text-[#6B7280]">Save the product first to upload a cover image.</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
