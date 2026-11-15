import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { EntityCombobox, type EntityOption } from '@/components/entity-combobox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  kindHasVariants,
  kindToProductType,
  type ProductKind,
} from '@/config/catalog'
import { formatBDT } from '@/lib/format'
import { queryKeys } from '@/lib/query/keys'
import { useAuth } from '@/features/auth/auth-session'
import { useToast } from '@/components/ui/toast'
import { ProductImageUploader } from './ProductImageUploader'
import { VariantImageUploader } from './VariantImageUploader'
import { ProductTypeSelector } from './VariantMatrixBuilder'
import { VariantMatrixBuilder } from './VariantMatrixBuilder'
import { QuickCreateNamedEntityDialog } from './QuickCreateNamedEntityDialog'
import {
  generateVariantMatrixStrict,
  profitPreview,
} from '../lib/variant-matrix'
import {
  generateBaseBarcode,
  generateBaseSku,
} from '../lib/product-identifiers'
import { buildBranchPricesPayload } from '../lib/branch-price-payload'
import {
  PRODUCT_IMAGE_ACCEPT,
  createBrand,
  createCategory,
  createProductAtomic,
  createSubcategory,
  listVariants,
  searchBrands,
  searchCategories,
  searchSubcategories,
  transitionProductStatus,
  updateProduct,
  uploadProductImage,
  validateProductImageFile,
  type ProductInput,
  type ProductListItem,
} from '../repositories/catalog.repository'
import { ProductStatusBadge } from './ProductStatusBadge'
import { ProductActivityTimeline } from './ProductActivityTimeline'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { OpeningStockFields, type OpeningStockInput } from './OpeningStockFields'
import {
  VariantOpeningStockTable,
  type VariantOpeningStockMeta,
} from './VariantOpeningStockTable'
import { invalidateStorefrontCache } from '@/features/storefront/storefront.service'

export type ProductFormState = {
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

export function emptyProductForm(): ProductFormState {
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

export function productToForm(p: ProductListItem | null): ProductFormState {
  if (!p) return emptyProductForm()

  let productKind: ProductKind = 'simple'
  if (p.product_type === 'bundle') productKind = 'bundle'
  else if (p.product_type === 'service') productKind = 'service'
  else if (p.product_type === 'variable') {
    const expiryTracked = Boolean((p as { expiry_tracking_enabled?: boolean }).expiry_tracking_enabled)
    productKind = expiryTracked ? 'cosmetics' : 'size_color'
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
    publish: Boolean(p.published_at),
    productKind,
  }
}

type Props = {
  orgId: string
  editing: ProductListItem | null
  title: string
  backTo?: string
  onSaved: (productId: string) => void
  onError: (message: string) => void
}

export function ProductForm({
  orgId,
  editing,
  title,
  backTo = '/products',
  onSaved,
  onError,
}: Props) {
  const { can } = useAuth()
  const { toast } = useToast()
  const canActivateOnSave = can(['products.approve', 'products.create'])
  const [form, setForm] = useState<ProductFormState>(() => productToForm(editing))
  const [createdId, setCreatedId] = useState<string | null>(editing?.id ?? null)
  const [sizes, setSizes] = useState<string[]>([])
  const [colors, setColors] = useState<string[]>([])
  const [pendingCover, setPendingCover] = useState<File | null>(null)
  const [pendingVariantImages, setPendingVariantImages] = useState<Record<string, File | null>>({})
  const [categoryCode, setCategoryCode] = useState<string | null>(null)
  const [brandCode, setBrandCode] = useState<string | null>(null)
  const [categoryLabel, setCategoryLabel] = useState<string | null>(editing?.categories?.name ?? null)
  const [subcategoryLabel, setSubcategoryLabel] = useState<string | null>(
    editing?.subcategories?.name ?? null,
  )
  const [brandLabel, setBrandLabel] = useState<string | null>(editing?.brands?.name ?? null)
  const [createDialog, setCreateDialog] = useState<'category' | 'subcategory' | 'brand' | null>(null)
  const [openingStock, setOpeningStock] = useState<OpeningStockInput>({
    branchId: '',
    locationId: '',
    quantity: 0,
    unitCost: 0,
    batchNumber: '',
    expiresAt: '',
  })
  const [variantStock, setVariantStock] = useState<Record<string, number>>({})
  const [skuTouched, setSkuTouched] = useState(false)
  const [barcodeTouched, setBarcodeTouched] = useState(false)

  useEffect(() => {
    setForm(productToForm(editing))
    setCreatedId(editing?.id ?? null)
    setSizes([])
    setColors([])
    setPendingCover(null)
    setPendingVariantImages({})
    setCategoryLabel(editing?.categories?.name ?? null)
    setSubcategoryLabel(editing?.subcategories?.name ?? null)
    setBrandLabel(editing?.brands?.name ?? null)
    setCategoryCode(null)
    setBrandCode(null)
    setOpeningStock({
      branchId: '',
      locationId: '',
      quantity: 0,
      unitCost: 0,
      batchNumber: '',
      expiresAt: '',
    })
    setVariantStock({})
    setSkuTouched(false)
    setBarcodeTouched(false)
    if (!editing) {
      setForm((f) => ({ ...f, base_barcode: generateBaseBarcode() }))
    }
  }, [editing])

  useEffect(() => {
    if (editing || skuTouched) return
    const name = form.name.trim()
    if (!name) {
      setForm((f) => ({ ...f, base_sku: '' }))
      return
    }
    setForm((f) => ({ ...f, base_sku: generateBaseSku(name) }))
  }, [form.name, editing, skuTouched])

  const onSearchCategories = useCallback((q: string) => searchCategories(q), [])
  const onSearchBrands = useCallback((q: string) => searchBrands(q), [])
  const onSearchSubcategories = useCallback(
    (q: string) => searchSubcategories(q, form.category_id),
    [form.category_id],
  )

  const applyCategory = useCallback((id: string | null, opt?: EntityOption | null) => {
    setForm((f) => ({ ...f, category_id: id, subcategory_id: null }))
    setCategoryLabel(opt?.label ?? null)
    setCategoryCode(opt?.description ?? opt?.meta?.code ?? null)
    setSubcategoryLabel(null)
  }, [])

  const applySubcategory = useCallback((id: string | null, opt?: EntityOption | null) => {
    const parentId = opt?.meta?.categoryId ?? null
    const parentName = opt?.meta?.categoryName ?? opt?.description ?? null
    setForm((f) => ({
      ...f,
      subcategory_id: id,
      ...(parentId ? { category_id: parentId } : {}),
    }))
    setSubcategoryLabel(opt?.label ?? null)
    if (parentId) {
      setCategoryLabel(parentName)
    }
  }, [])

  const applyBrand = useCallback((id: string | null, opt?: EntityOption | null) => {
    setForm((f) => ({ ...f, brand_id: id }))
    setBrandLabel(opt?.label ?? null)
    setBrandCode(opt?.description ?? opt?.meta?.code ?? null)
  }, [])

  const variantDrafts = useMemo(() => {
    if (!kindHasVariants(form.productKind)) return []
    return generateVariantMatrixStrict({
      sizes,
      colors,
      purchasePrice: Number(form.purchase_price) || 0,
      sellingPrice: Number(form.selling_price) || 0,
      wholesalePrice: form.wholesale_price ? Number(form.wholesale_price) : null,
      categoryCode,
      brandCode,
    })
  }, [form, sizes, colors, categoryCode, brandCode])

  const variantStockSignature = useMemo(
    () => variantDrafts.map((v) => v.key).join('|'),
    [variantDrafts],
  )

  useEffect(() => {
    setVariantStock((prev) => {
      const next: Record<string, number> = {}
      for (const variant of variantDrafts) {
        next[variant.key] = prev[variant.key] ?? 0
      }
      return next
    })
    setPendingVariantImages((prev) => {
      const next: Record<string, File | null> = {}
      for (const variant of variantDrafts) {
        next[variant.key] = prev[variant.key] ?? null
      }
      return next
    })
  }, [variantStockSignature])

  const { data: editVariants = [], isLoading: editVariantsLoading } = useQuery({
    queryKey: queryKeys.variants({ productId: editing?.id, pageSize: 200 }),
    queryFn: () => listVariants({ productId: editing!.id, pageSize: 200 }),
    enabled: Boolean(editing?.id),
    select: (result) => result.items,
  })

  const variantOpeningMeta: VariantOpeningStockMeta = {
    branchId: openingStock.branchId,
    locationId: openingStock.locationId,
    unitCost: openingStock.unitCost || Number(form.purchase_price) || 0,
    batchNumber: openingStock.batchNumber,
    expiresAt: openingStock.expiresAt,
  }

  const profit = profitPreview(Number(form.purchase_price) || 0, Number(form.selling_price) || 0)
  const productId = editing?.id ?? createdId
  const isMatrix = kindHasVariants(form.productKind) && !editing
  const matrixInvalid = isMatrix && (sizes.length === 0 || colors.length === 0 || variantDrafts.length === 0)

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
              : mode === 'save' && canActivateOnSave
                ? 'active'
                : form.publish
                  ? 'active'
                  : 'draft'

      let createdVariants: Array<{ id: string; sku?: string; key?: string }> = []

      if (editing && id) {
        await updateProduct(id, input)
        if (mode !== 'save') {
          await transitionProductStatus({ product_id: id, status, publish: mode === 'activate' })
        }
      } else if (id) {
        await updateProduct(id, input)
      } else {
        if (matrixInvalid) {
          throw new Error('Select at least one size/volume and one color/shade for variant products.')
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
            key: v.key,
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

        const unitCost = openingStock.unitCost || Number(form.purchase_price) || 0

        if (isMatrix) {
          const stockEntries = variantDrafts
            .filter((v) => (variantStock[v.key] ?? 0) > 0)
            .map((v) => ({
              branch_id: openingStock.branchId,
              location_id: openingStock.locationId,
              variant_key: v.key,
              quantity: variantStock[v.key],
              unit_cost: unitCost,
              batch_number: openingStock.batchNumber?.trim() || null,
              expires_at: openingStock.expiresAt?.trim() || null,
            }))

          if (stockEntries.length > 0) {
            if (!openingStock.branchId || !openingStock.locationId) {
              throw new Error('Select branch and location for opening stock.')
            }
            if (unitCost <= 0) {
              throw new Error('Opening stock requires a unit purchase cost.')
            }
            if (form.productKind === 'cosmetics' && !openingStock.expiresAt?.trim()) {
              throw new Error('Expiry date is required for cosmetics opening stock.')
            }
            payload.opening_stock = stockEntries
          }

          const branchPrices = buildBranchPricesPayload({
            branchId: openingStock.branchId,
            isMatrix: true,
            variantDrafts,
            variantStock,
            retailPrice: Number(form.selling_price) || 0,
            wholesalePrice: form.wholesale_price ? Number(form.wholesale_price) : null,
          })
          if (branchPrices.length > 0) {
            payload.branch_prices = branchPrices
          }
        } else if (openingStock.quantity > 0) {
          if (!openingStock.branchId || !openingStock.locationId) {
            throw new Error('Select branch and location for opening stock.')
          }
          if (unitCost <= 0) {
            throw new Error('Opening stock requires a unit purchase cost.')
          }
          if (form.productKind === 'cosmetics' && !openingStock.expiresAt?.trim()) {
            throw new Error('Expiry date is required for cosmetics opening stock.')
          }
          payload.opening_stock = [
            {
              branch_id: openingStock.branchId,
              location_id: openingStock.locationId,
              quantity: openingStock.quantity,
              unit_cost: unitCost,
              batch_number: openingStock.batchNumber?.trim() || null,
              expires_at: openingStock.expiresAt?.trim() || null,
            },
          ]

          const branchPrices = buildBranchPricesPayload({
            branchId: openingStock.branchId,
            isMatrix: false,
            retailPrice: Number(form.selling_price) || 0,
            wholesalePrice: form.wholesale_price ? Number(form.wholesale_price) : null,
            openingQuantity: openingStock.quantity,
          })
          if (branchPrices.length > 0) {
            payload.branch_prices = branchPrices
          }
        }
        const result = await createProductAtomic(payload)
        id = String(result.product_id)
        createdVariants = result.variants ?? []
        setCreatedId(id)
      }

      let uploadedImages = false

      if (pendingCover && id) {
        await uploadProductImage(orgId, id, pendingCover, { isCover: true })
        setPendingCover(null)
        uploadedImages = true
      }

      if (id && createdVariants.length > 0) {
        const uploads = createdVariants
          .map((created) => {
            const key = created.key
            const file = key ? pendingVariantImages[key] : null
            if (!file || !created.id) return null
            return uploadProductImage(orgId, id!, file, {
              variantId: created.id,
              isCover: false,
            })
          })
          .filter(Boolean)
        if (uploads.length > 0) {
          await Promise.all(uploads)
          setPendingVariantImages({})
          uploadedImages = true
        }
      }

      if (uploadedImages) {
        invalidateStorefrontCache()
      }

      return { id: id!, status }
    },
    onSuccess: ({ id, status }) => {
      if (status === 'draft') {
        toast('Saved as draft — activate to show in POS')
      }
      onSaved(id)
    },
    onError: (e: Error) => onError(e.message),
  })

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-3 py-4 sm:px-4 lg:px-0">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={backTo}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 font-serif text-2xl text-[#111111]">
            {title}
            {editing?.status ? <ProductStatusBadge status={editing.status} /> : null}
          </h1>
          <p className="text-sm text-[#6B7280]">
            Save draft, submit for approval, or activate for POS and storefront.
          </p>
        </div>
      </div>

      <form
        className="space-y-4 rounded-xl border border-border bg-white p-4 sm:p-6"
        onSubmit={(e) => {
          e.preventDefault()
          if (matrixInvalid) {
            onError('Select at least one size/volume and one color/shade for variant products.')
            return
          }
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
              onChange={applyCategory}
              onSearch={onSearchCategories}
              placeholder="Category"
              initialLabel={categoryLabel}
              onCreate={() => setCreateDialog('category')}
              createLabel="Create new category"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Subcategory</Label>
            <EntityCombobox
              value={form.subcategory_id}
              onChange={applySubcategory}
              onSearch={onSearchSubcategories}
              placeholder="Subcategory"
              initialLabel={subcategoryLabel}
              onCreate={() => setCreateDialog('subcategory')}
              createLabel="Create new subcategory"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Brand</Label>
          <EntityCombobox
            value={form.brand_id}
            onChange={applyBrand}
            onSearch={onSearchBrands}
            placeholder="Brand"
            initialLabel={brandLabel}
            onCreate={() => setCreateDialog('brand')}
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
              placeholder="Auto from product name"
              onChange={(e) => {
                setSkuTouched(true)
                setForm((f) => ({ ...f, base_sku: e.target.value }))
              }}
            />
            {!editing && !skuTouched ? (
              <p className="text-xs text-[#6B7280]">Auto-generated from the first two letters of the name.</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prod-barcode">Barcode</Label>
            <Input
              id="prod-barcode"
              value={form.base_barcode}
              placeholder="8-digit barcode"
              inputMode="numeric"
              maxLength={8}
              onChange={(e) => {
                setBarcodeTouched(true)
                setForm((f) => ({ ...f, base_barcode: e.target.value.replace(/\D/g, '').slice(0, 8) }))
              }}
            />
            {!editing && !barcodeTouched ? (
              <p className="text-xs text-[#6B7280]">Auto-generated 8-digit barcode — editable.</p>
            ) : null}
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

        {!editing ? (
          isMatrix && variantDrafts.length > 0 ? (
            <VariantOpeningStockTable
              variants={variantDrafts}
              quantities={variantStock}
              meta={variantOpeningMeta}
              onMetaChange={(next) =>
                setOpeningStock((prev) => ({
                  ...prev,
                  branchId: next.branchId,
                  locationId: next.locationId,
                  unitCost: next.unitCost || Number(form.purchase_price) || 0,
                  batchNumber: next.batchNumber,
                  expiresAt: next.expiresAt,
                }))
              }
              onQuantityChange={(variantKey, quantity) =>
                setVariantStock((prev) => ({ ...prev, [variantKey]: quantity }))
              }
              pendingImages={pendingVariantImages}
              onPendingImageChange={(variantKey, file) =>
                setPendingVariantImages((prev) => ({ ...prev, [variantKey]: file }))
              }
              purchasePrice={Number(form.purchase_price) || 0}
              sellingPrice={Number(form.selling_price) || 0}
              requiresExpiry={form.productKind === 'cosmetics'}
            />
          ) : !isMatrix ? (
            <OpeningStockFields
              value={{
                ...openingStock,
                unitCost: openingStock.unitCost || Number(form.purchase_price) || 0,
              }}
              onChange={(next) =>
                setOpeningStock({
                  ...next,
                  unitCost: next.unitCost || Number(form.purchase_price) || 0,
                })
              }
              purchasePrice={Number(form.purchase_price) || 0}
              sellingPrice={Number(form.selling_price) || 0}
              variantCount={1}
              requiresExpiry={form.productKind === 'cosmetics'}
            />
          ) : null
        ) : null}

        <div className="space-y-1.5">
          <Label>Cover image</Label>
          {productId ? (
            <ProductImageUploader orgId={orgId} productId={productId} currentUrl={editing?.coverUrl} />
          ) : (
            <div className="space-y-2">
              <Input
                type="file"
                accept={PRODUCT_IMAGE_ACCEPT}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null
                  if (!file) {
                    setPendingCover(null)
                    return
                  }
                  const err = validateProductImageFile(file)
                  if (err) {
                    onError(err)
                    e.target.value = ''
                    return
                  }
                  setPendingCover(file)
                }}
              />
              <p className="text-xs text-[#6B7280]">
                Image uploads automatically when you save the product.
              </p>
            </div>
          )}
        </div>

        {editing && editVariants.length > 0 ? (
          <div className="space-y-3 rounded-xl border border-border bg-[#FAFAF9] p-4">
            <div>
              <p className="text-sm font-semibold text-[#111111]">Variant images</p>
              <p className="text-xs text-[#6B7280]">
                Upload or replace an image per variant. Changes save immediately.
              </p>
            </div>
            {editVariantsLoading ? (
              <div className="flex items-center gap-2 text-sm text-[#6B7280]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading variants…
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {editVariants.map((variant) => (
                  <div
                    key={variant.id}
                    className="flex items-start gap-3 rounded-lg border border-border bg-white p-3"
                  >
                    <VariantImageUploader
                      orgId={orgId}
                      productId={editing.id}
                      variantId={variant.id}
                      currentPathOrUrl={variant.image_path}
                      label={variant.name ?? variant.sku}
                      compact
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#111111]">
                        {variant.name ?? variant.sku}
                      </p>
                      <p className="truncate text-xs text-[#6B7280]">{variant.sku}</p>
                      <p className="mt-1 text-xs text-[#6B7280]">
                        {formatBDT(Number(variant.selling_price))}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

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
          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-sm font-semibold">Activity</p>
            <ProductActivityTimeline productId={productId} />
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" asChild>
            <Link to={backTo}>Cancel</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={saveMutation.isPending || matrixInvalid}
            onClick={() => saveMutation.mutate('draft')}
          >
            Save Draft
          </Button>
          <PermissionGate permission="products.submit">
            <Button
              type="button"
              variant="secondary"
              disabled={saveMutation.isPending || matrixInvalid}
              onClick={() => saveMutation.mutate('submit')}
            >
              Submit
            </Button>
          </PermissionGate>
          <PermissionGate permission="products.approve">
            <Button
              type="button"
              disabled={saveMutation.isPending || matrixInvalid}
              onClick={() => saveMutation.mutate('activate')}
            >
              Activate
            </Button>
          </PermissionGate>
          <Button type="submit" disabled={saveMutation.isPending || matrixInvalid}>
            {saveMutation.isPending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : editing ? (
              'Save changes'
            ) : (
              'Save product'
            )}
          </Button>
        </div>
      </form>

      <QuickCreateNamedEntityDialog
        open={createDialog === 'category'}
        onOpenChange={(open) => !open && setCreateDialog(null)}
        title="Create category"
        namePlaceholder="Category name"
        onSubmit={async ({ name }) => {
          const row = await createCategory(orgId, { name, is_active: true })
          return { id: row.id, label: row.name, meta: { code: row.code ?? undefined } }
        }}
        onCreated={(opt) => applyCategory(opt.id, opt)}
        onError={onError}
      />

      <QuickCreateNamedEntityDialog
        open={createDialog === 'subcategory'}
        onOpenChange={(open) => !open && setCreateDialog(null)}
        title="Create subcategory"
        namePlaceholder="Subcategory name"
        parentCategory={{
          value: form.category_id,
          onSearch: onSearchCategories,
          initialLabel: categoryLabel,
          required: true,
        }}
        onSubmit={async ({ name, categoryId }) => {
          const cats = await searchCategories('')
          const parent = cats.find((c) => c.id === categoryId)
          const row = await createSubcategory(orgId, {
            name,
            category_id: categoryId!,
            is_active: true,
          })
          return {
            id: row.id,
            label: row.name,
            meta: {
              categoryId: categoryId ?? undefined,
              categoryName: parent?.label ?? categoryLabel ?? undefined,
            },
          }
        }}
        onCreated={(opt) => applySubcategory(opt.id, opt)}
        onError={onError}
      />

      <QuickCreateNamedEntityDialog
        open={createDialog === 'brand'}
        onOpenChange={(open) => !open && setCreateDialog(null)}
        title="Create brand"
        namePlaceholder="Brand name"
        onSubmit={async ({ name }) => {
          const row = await createBrand(orgId, { name, is_active: true })
          return { id: row.id, label: row.name, meta: { code: row.code ?? undefined } }
        }}
        onCreated={(opt) => applyBrand(opt.id, opt)}
        onError={onError}
      />
    </div>
  )
}
