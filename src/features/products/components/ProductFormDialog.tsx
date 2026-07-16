import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { EntityCombobox } from '@/components/entity-combobox'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  kindHasVariants,
  kindToProductType,
  type ProductKind,
} from '@/config/catalog'
import { formatBDT } from '@/lib/format'
import { ProductImageUploader } from '../components/ProductImageUploader'
import { ProductTypeSelector } from '../components/VariantMatrixBuilder'
import { VariantMatrixBuilder } from '../components/VariantMatrixBuilder'
import {
  DEFAULT_APPAREL_SIZES,
  DEFAULT_COLORS,
  generateVariantMatrix,
  profitPreview,
} from '../lib/variant-matrix'
import {
  createBrand,
  createCategory,
  createProductAtomic,
  searchBrands,
  searchCategories,
  searchSubcategories,
  transitionProductStatus,
  updateProduct,
  uploadProductImage,
  type ProductInput,
  type ProductListItem,
} from '../repositories/catalog.repository'
import { ProductStatusBadge } from './ProductStatusBadge'
import { BranchPriceEditor } from './BranchPriceEditor'
import { ProductActivityTimeline } from './ProductActivityTimeline'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'

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
  publish: boolean
  productKind: ProductKind
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
      publish: false,
      productKind: 'simple',
    }
  }
  const kind: ProductKind = p.has_variants
    ? p.product_type === 'variable'
      ? 'size_color'
      : 'simple'
    : 'simple'
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
    publish: Boolean(p.published_at),
    productKind: kind,
  }
}

export function ProductFormDialog({ open, onOpenChange, orgId, editing, onSaved, onError }: Props) {
  const [form, setForm] = useState<FormState>(() => toForm(editing))
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [sizes, setSizes] = useState<string[]>([])
  const [colors, setColors] = useState<string[]>([])
  const [pendingCover, setPendingCover] = useState<File | null>(null)
  const [categoryCode, setCategoryCode] = useState<string | null>(null)
  const [brandCode, setBrandCode] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setForm(toForm(editing))
      setCreatedId(editing?.id ?? null)
      setSizes([])
      setColors([])
      setPendingCover(null)
    }
  }, [open, editing])

  const onSearchCategories = useCallback((q: string) => searchCategories(q), [])
  const onSearchBrands = useCallback((q: string) => searchBrands(q), [])
  const onSearchSubcategories = useCallback(
    (q: string) => searchSubcategories(q, form.category_id),
    [form.category_id],
  )

  const variantDrafts = useMemo(() => {
    if (!kindHasVariants(form.productKind)) return []
    return generateVariantMatrix({
      sizes: sizes.length ? sizes : DEFAULT_APPAREL_SIZES.slice(0, 0),
      colors: colors.length ? colors : DEFAULT_COLORS.slice(0, 0),
      purchasePrice: Number(form.purchase_price) || 0,
      sellingPrice: Number(form.selling_price) || 0,
      wholesalePrice: form.wholesale_price ? Number(form.wholesale_price) : null,
      categoryCode,
      brandCode,
    })
  }, [form, sizes, colors, categoryCode, brandCode])

  const profit = profitPreview(Number(form.purchase_price) || 0, Number(form.selling_price) || 0)
  const productId = editing?.id ?? createdId
  const isMatrix = kindHasVariants(form.productKind) && !editing

  const saveMutation = useMutation({
    mutationFn: async (mode: 'draft' | 'save' | 'submit' | 'activate' = 'save') => {
      const input: ProductInput = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        category_id: form.category_id,
        subcategory_id: form.subcategory_id,
        brand_id: form.brand_id,
        product_type: kindToProductType(form.productKind),
        base_sku: form.base_sku.trim() || null,
        base_barcode: form.base_barcode.trim() || null,
        purchase_price: Number(form.purchase_price) || 0,
        selling_price: Number(form.selling_price) || 0,
        wholesale_price: form.wholesale_price ? Number(form.wholesale_price) : null,
        reorder_level: Number(form.reorder_level) || 0,
        is_active: form.is_active,
        has_variants: kindHasVariants(form.productKind),
        publish: form.publish || mode === 'activate',
      }

      let id = productId
      const status =
        mode === 'draft'
          ? 'draft'
          : mode === 'submit'
            ? 'pending_approval'
            : mode === 'activate'
              ? 'active'
              : form.publish
                ? 'active'
                : 'draft'

      if (editing && id) {
        await updateProduct(id, input)
        if (mode !== 'save') {
          await transitionProductStatus({ product_id: id, status, publish: mode === 'activate' })
        }
      } else if (id) {
        await updateProduct(id, input)
      } else {
        if (isMatrix && !variantDrafts.length) {
          throw new Error('Select at least one size and one color/shade for variant products.')
        }
        const payload: Record<string, unknown> = {
          ...input,
          status,
          publish: status === 'active',
          batch_tracking_enabled: form.productKind === 'cosmetics',
          expiry_tracking_enabled: form.productKind === 'cosmetics',
        }
        if (isMatrix) {
          payload.options = [
            {
              name: form.productKind === 'cosmetics' ? 'Volume' : 'Size',
              values: sizes.map((v) => ({ value: v })),
            },
            {
              name: form.productKind === 'cosmetics' ? 'Shade' : 'Color',
              values: colors.map((v) => ({ value: v })),
            },
          ]
          payload.variants = variantDrafts.map((v) => ({
            size: v.size,
            color: v.color,
            sku: v.sku,
            barcode: v.barcode || null,
            name: v.label,
            purchase_price: v.purchase_price,
            selling_price: v.selling_price,
            wholesale_price: v.wholesale_price,
            is_active: v.is_active,
          }))
        }
        const result = await createProductAtomic(payload)
        id = String(result.product_id)
        setCreatedId(id)
      }

      if (pendingCover && id) {
        await uploadProductImage(orgId, id, pendingCover, { isCover: true })
        setPendingCover(null)
      }

      return id!
    },
    onSuccess: (id) => onSaved(id),
    onError: (e: Error) => onError(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {editing ? 'Edit product' : 'Add new product'}
            {editing?.status ? <ProductStatusBadge status={editing.status} /> : null}
          </DialogTitle>
          <p className="text-sm text-[#6B7280]">
            Save draft, submit for approval, or activate for POS and storefront.
          </p>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            saveMutation.mutate('save')
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="prod-name">Product name</Label>
            <Input
              id="prod-name"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          {!editing ? (
            <div className="space-y-1.5">
              <Label>Product type</Label>
              <ProductTypeSelector
                value={form.productKind}
                onChange={(productKind) => setForm((f) => ({ ...f, productKind }))}
              />
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <EntityCombobox
                value={form.category_id}
                onChange={(id, opt) => {
                  setForm((f) => ({ ...f, category_id: id, subcategory_id: null }))
                  setCategoryCode(opt?.description ?? null)
                }}
                onSearch={onSearchCategories}
                placeholder="Category"
                onCreate={() => {
                  const name = window.prompt('New category name')
                  if (!name?.trim()) return
                  void createCategory(orgId, { name: name.trim(), is_active: true }).then((row) => {
                    setForm((f) => ({ ...f, category_id: row.id }))
                    setCategoryCode(row.code)
                  })
                }}
                createLabel="Create new category"
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
              onChange={(id, opt) => {
                setForm((f) => ({ ...f, brand_id: id }))
                setBrandCode(opt?.description ?? null)
              }}
              onSearch={onSearchBrands}
              placeholder="Brand"
              onCreate={() => {
                const name = window.prompt('New brand name')
                if (!name?.trim()) return
                void createBrand(orgId, { name: name.trim(), is_active: true }).then((row) => {
                  setForm((f) => ({ ...f, brand_id: row.id }))
                  setBrandCode(row.code)
                })
              }}
              createLabel="Create new brand"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prod-desc">Description</Label>
            <textarea
              id="prod-desc"
              rows={3}
              className="flex min-h-[80px] w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <VariantMatrixBuilder
            kind={form.productKind}
            sizes={sizes}
            colors={colors}
            onSizesChange={setSizes}
            onColorsChange={setColors}
            variantCount={variantDrafts.length}
          />

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
              <Label htmlFor="prod-cost">Purchase price</Label>
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
              <Label htmlFor="prod-price">Retail price</Label>
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
              <Label htmlFor="prod-reorder">Reorder level</Label>
              <Input
                id="prod-reorder"
                type="number"
                min={0}
                value={form.reorder_level}
                onChange={(e) => setForm((f) => ({ ...f, reorder_level: e.target.value }))}
              />
            </div>
          </div>

          <div className="rounded-lg bg-[#F8F6F2] px-3 py-2 text-xs text-[#6B7280]">
            Purchase: {formatBDT(Number(form.purchase_price) || 0)} · Retail:{' '}
            {formatBDT(Number(form.selling_price) || 0)} · Est. profit:{' '}
            {formatBDT(profit.profit)} ({profit.margin.toFixed(0)}% margin)
          </div>

          <div className="space-y-1.5">
            <Label>Cover image</Label>
            {productId ? (
              <ProductImageUploader orgId={orgId} productId={productId} currentUrl={editing?.coverUrl} />
            ) : (
              <div className="space-y-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPendingCover(e.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-[#6B7280]">
                  Image uploads automatically when you save the product.
                </p>
              </div>
            )}
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
                checked={form.publish}
                onChange={(e) => setForm((f) => ({ ...f, publish: e.target.checked }))}
              />
              Publish to storefront
            </label>
          </div>

          {productId ? (
            <>
              <PermissionGate permission="products.manage_prices">
                <div className="space-y-2 border-t border-border pt-4">
                  <p className="text-sm font-semibold">Branch prices</p>
                  <BranchPriceEditor productId={productId} />
                </div>
              </PermissionGate>
              <div className="space-y-2 border-t border-border pt-4">
                <p className="text-sm font-semibold">Activity</p>
                <ProductActivityTimeline productId={productId} />
              </div>
            </>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate('draft')}
            >
              Save Draft
            </Button>
            <PermissionGate permission="products.submit">
              <Button
                type="button"
                variant="secondary"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate('submit')}
              >
                Submit
              </Button>
            </PermissionGate>
            <PermissionGate permission="products.approve">
              <Button
                type="button"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate('activate')}
              >
                Activate
              </Button>
            </PermissionGate>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : editing ? 'Save changes' : 'Save product'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
