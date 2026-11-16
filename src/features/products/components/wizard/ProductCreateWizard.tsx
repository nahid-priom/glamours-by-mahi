import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { queryKeys } from '@/lib/query/keys'
import { EntityCombobox, type EntityOption } from '@/components/entity-combobox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  PRODUCT_KIND_LABELS,
  kindHasVariants,
  kindToProductType,
  type ProductKind,
} from '@/config/catalog'
import { formatBDT } from '@/lib/format'
import { useAuth } from '@/features/auth/auth-session'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { ProductTypeSelector, VariantMatrixBuilder } from '../VariantMatrixBuilder'
import { QuickCreateNamedEntityDialog } from '../QuickCreateNamedEntityDialog'
import { BarcodePrintDialog, type BarcodePrintItem } from '../BarcodePrintDialog'
import { generateVariantMatrixStrict, type VariantDraft } from '../../lib/variant-matrix'
import { generateBaseBarcode, generateBaseSku } from '../../lib/product-identifiers'
import { buildBranchPricesPayload } from '../../lib/branch-price-payload'
import {
  PM,
  type ProductEntryMode,
  type WizardStepId,
} from '../../lib/product-module-theme'
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
  syncProductVariantPrices,
  transitionProductStatus,
  updateProduct,
  uploadProductImage,
  validateProductImageFile,
  type ProductListItem,
} from '../../repositories/catalog.repository'
import { ProductImageUploader } from '../ProductImageUploader'
import { ProductStatusBadge } from '../ProductStatusBadge'
import { invalidateStorefrontCache } from '@/features/storefront/storefront.service'
import { ProductEntryModeCards } from './ProductEntryModeCards'
import { ProductWizardStepper } from './ProductWizardStepper'
import { ProductSummaryPanel } from './ProductSummaryPanel'
import { ProductSuccessScreen, type ProductSuccessPayload } from './ProductSuccessScreen'
import { VariantPricingMatrix } from './VariantPricingMatrix'
import { BranchStockMatrix, type StockMatrixRow } from './BranchStockMatrix'
import { emptyProductForm, productToForm, type ProductFormState } from '../ProductForm'
import { cn } from '@/lib/utils'

type Props = {
  orgId: string
  editing?: ProductListItem | null
  onError: (message: string) => void
  onCreated?: (productId: string) => void
  onSaved?: (productId: string) => void
}

function entryModeForProduct(p: ProductListItem | null | undefined): ProductEntryMode {
  if (!p) return 'variant'
  if (p.has_variants || p.product_type === 'variable') return 'variant'
  return 'quick'
}

export function ProductCreateWizard({
  orgId,
  editing = null,
  onError,
  onCreated,
  onSaved,
}: Props) {
  const { can } = useAuth()
  const navigate = useNavigate()
  const canCreate = can('products.create')
  const canApprove = can('products.approve')
  const isEdit = Boolean(editing?.id)

  const [entryMode, setEntryMode] = useState<ProductEntryMode | null>(() =>
    editing ? entryModeForProduct(editing) : null,
  )
  const [step, setStep] = useState<WizardStepId>('info')
  const [form, setForm] = useState<ProductFormState>(() =>
    editing
      ? productToForm(editing)
      : { ...emptyProductForm(), base_barcode: generateBaseBarcode() },
  )
  const [sizes, setSizes] = useState<string[]>([])
  const [colors, setColors] = useState<string[]>([])
  const [variantOverrides, setVariantOverrides] = useState<VariantDraft[] | null>(null)
  const [stockRows, setStockRows] = useState<StockMatrixRow[]>([])
  const [batchNumber, setBatchNumber] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [pendingCover, setPendingCover] = useState<File | null>(null)
  const [categoryCode, setCategoryCode] = useState<string | null>(null)
  const [brandCode, setBrandCode] = useState<string | null>(null)
  const [categoryLabel, setCategoryLabel] = useState<string | null>(
    editing?.categories?.name ?? null,
  )
  const [subcategoryLabel, setSubcategoryLabel] = useState<string | null>(
    editing?.subcategories?.name ?? null,
  )
  const [brandLabel, setBrandLabel] = useState<string | null>(editing?.brands?.name ?? null)
  const [createDialog, setCreateDialog] = useState<'category' | 'subcategory' | 'brand' | null>(null)
  const [skuTouched, setSkuTouched] = useState(() => Boolean(editing))
  const [success, setSuccess] = useState<ProductSuccessPayload | null>(null)
  const [printOpen, setPrintOpen] = useState(false)
  const [printItems, setPrintItems] = useState<BarcodePrintItem[]>([])
  const [keepDefaults, setKeepDefaults] = useState({
    category_id: null as string | null,
    brand_id: null as string | null,
    categoryLabel: null as string | null,
    brandLabel: null as string | null,
    categoryCode: null as string | null,
    brandCode: null as string | null,
  })

  const isQuick = entryMode === 'quick'
  const isMatrixKind = kindHasVariants(form.productKind)

  useEffect(() => {
    if (entryMode === 'bulk') {
      navigate('/products/import')
    }
  }, [entryMode, navigate])

  useEffect(() => {
    if (skuTouched) return
    const name = form.name.trim()
    if (!name) {
      setForm((f) => ({ ...f, base_sku: '' }))
      return
    }
    setForm((f) => ({ ...f, base_sku: generateBaseSku(name) }))
  }, [form.name, skuTouched])

  useEffect(() => {
    if (isEdit) return
    if (entryMode === 'quick') {
      setForm((f) => ({ ...f, productKind: 'simple' }))
    } else if (entryMode === 'variant' && form.productKind === 'simple') {
      setForm((f) => ({ ...f, productKind: 'size_color' }))
    }
  }, [entryMode, isEdit])

  const { data: existingVariants = [] } = useQuery({
    queryKey: queryKeys.variants({ productId: editing?.id, pageSize: 200 }),
    queryFn: () => listVariants({ productId: editing!.id, pageSize: 200 }),
    enabled: Boolean(isEdit && editing?.id),
    select: (result) => result.items,
  })

  const generatedVariants = useMemo(() => {
    if (!isMatrixKind) return []
    return generateVariantMatrixStrict({
      sizes,
      colors,
      purchasePrice: Number(form.purchase_price) || 0,
      sellingPrice: Number(form.selling_price) || 0,
      wholesalePrice: form.wholesale_price ? Number(form.wholesale_price) : null,
      categoryCode,
      brandCode,
    })
  }, [isMatrixKind, sizes, colors, form, categoryCode, brandCode])

  const variantDrafts = variantOverrides ?? generatedVariants

  useEffect(() => {
    setVariantOverrides(null)
  }, [sizes, colors, form.purchase_price, form.selling_price, categoryCode, brandCode])

  const stockVariants = useMemo(() => {
    if (isMatrixKind) {
      return variantDrafts.map((v) => ({
        key: v.key,
        label: v.label,
        purchase_price: v.purchase_price,
      }))
    }
    return [
      {
        key: 'default',
        label: form.name.trim() || 'Default',
        purchase_price: Number(form.purchase_price) || 0,
      },
    ]
  }, [isMatrixKind, variantDrafts, form.name, form.purchase_price])

  const totalOpeningQty = stockRows.reduce((s, r) => s + (r.quantity || 0), 0)

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
    if (parentId) setCategoryLabel(parentName)
  }, [])

  const applyBrand = useCallback((id: string | null, opt?: EntityOption | null) => {
    setForm((f) => ({ ...f, brand_id: id }))
    setBrandLabel(opt?.label ?? null)
    setBrandCode(opt?.description ?? opt?.meta?.code ?? null)
  }, [])

  const matrixInvalid =
    isMatrixKind && (sizes.length === 0 || colors.length === 0 || variantDrafts.length === 0)

  const validateStep = (target: WizardStepId): string | null => {
    if (!form.name.trim()) return 'Product name is required'
    if (target !== 'info' && !form.category_id) return 'Category is required'
    if (
      !isEdit &&
      (target === 'stock' || target === 'review') &&
      isMatrixKind &&
      matrixInvalid
    ) {
      return 'Select at least one size/volume and one color/shade'
    }
    return null
  }

  const goNext = () => {
    const order: WizardStepId[] = isQuick
      ? ['info', 'stock', 'review']
      : ['info', 'variants', 'stock', 'review']
    const idx = order.indexOf(step)
    const next = order[Math.min(idx + 1, order.length - 1)]
    const err = validateStep(next)
    if (err) {
      onError(err)
      return
    }
    setStep(next)
  }

  const goBack = () => {
    const order: WizardStepId[] = isQuick
      ? ['info', 'stock', 'review']
      : ['info', 'variants', 'stock', 'review']
    const idx = order.indexOf(step)
    if (idx <= 0) {
      if (isEdit && editing?.id) {
        navigate(`/products/${editing.id}`)
        return
      }
      setEntryMode(null)
      return
    }
    setStep(order[idx - 1])
  }

  const resetForAddAnother = () => {
    setSuccess(null)
    setStep('info')
    setSizes([])
    setColors([])
    setVariantOverrides(null)
    setStockRows([])
    setBatchNumber('')
    setExpiresAt('')
    setPendingCover(null)
    setSkuTouched(false)
    setForm({
      ...emptyProductForm(),
      productKind: entryMode === 'variant' ? 'size_color' : 'simple',
      base_barcode: generateBaseBarcode(),
      category_id: keepDefaults.category_id,
      brand_id: keepDefaults.brand_id,
    })
    setCategoryLabel(keepDefaults.categoryLabel)
    setBrandLabel(keepDefaults.brandLabel)
    setCategoryCode(keepDefaults.categoryCode)
    setBrandCode(keepDefaults.brandCode)
    setSubcategoryLabel(null)
  }

  const saveMutation = useMutation({
    mutationFn: async (mode: 'draft' | 'submit' | 'activate' | 'save') => {
      if (!form.category_id && (mode === 'activate' || (isEdit && mode === 'save' && form.is_active))) {
        throw new Error('Category is required to activate a product for POS')
      }
      if (!isEdit && matrixInvalid && isMatrixKind) {
        throw new Error('Select at least one size/volume and one color/shade for variant products.')
      }

      const status =
        mode === 'draft'
          ? 'draft'
          : mode === 'submit'
            ? 'pending_approval'
            : mode === 'activate'
              ? 'active'
              : String(editing?.status ?? 'draft')

      if (isEdit && editing) {
        const prevStatus = String(editing.status ?? 'draft')
        await updateProduct(editing.id, {
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
          has_variants: Boolean(editing.has_variants || isMatrixKind),
          publish: form.publish || mode === 'activate',
        })

        if (!editing.has_variants && !isMatrixKind) {
          await syncProductVariantPrices(editing.id, {
            purchase_price: Number(form.purchase_price) || 0,
            selling_price: Number(form.selling_price) || 0,
            wholesale_price: form.wholesale_price ? Number(form.wholesale_price) : null,
            onlyWhenSingleVariant: true,
          })
        }

        if (mode !== 'save' || status !== prevStatus) {
          await transitionProductStatus({
            product_id: editing.id,
            status,
            publish: mode === 'activate' || (mode === 'save' && form.publish),
          })
        }

        if (pendingCover) {
          await uploadProductImage(orgId, editing.id, pendingCover, { isCover: true })
          setPendingCover(null)
          invalidateStorefrontCache()
        }

        const prices =
          existingVariants.length > 0
            ? existingVariants.map((v) => Number(v.selling_price) || 0)
            : [Number(form.selling_price) || 0]
        const minP = Math.min(...prices)
        const maxP = Math.max(...prices)
        const priceLabel = minP === maxP ? formatBDT(minP) : `${formatBDT(minP)} – ${formatBDT(maxP)}`
        const barcodeReady =
          existingVariants.length > 0
            ? existingVariants.every((v) => Boolean(v.barcode?.trim()))
            : Boolean(form.base_barcode.trim())

        const successPayload: ProductSuccessPayload = {
          productId: editing.id,
          name: form.name.trim(),
          status: String(mode === 'save' ? editing.status ?? status : status),
          variantCount: existingVariants.length || (editing.has_variants ? editing.variantCount ?? 1 : 1),
          barcodeReady,
          totalOpeningQty: existingVariants.reduce((s, v) => s + Number(v.stockQty ?? 0), 0),
          priceLabel,
        }

        setPrintItems(
          existingVariants.length > 0
            ? existingVariants.map((v) => ({
                name: form.name.trim(),
                sku: v.sku ?? '—',
                barcode: v.barcode ?? '',
                price: Number(v.selling_price) || 0,
                variant: v.name ?? undefined,
              }))
            : [
                {
                  name: form.name.trim(),
                  sku: form.base_sku || '—',
                  barcode: form.base_barcode,
                  price: Number(form.selling_price) || 0,
                },
              ],
        )

        return successPayload
      }

      const clientTxnKey = crypto.randomUUID()
      const payload: Record<string, unknown> = {
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
        has_variants: isMatrixKind,
        publish: form.publish || mode === 'activate',
        status,
        batch_tracking_enabled: form.productKind === 'cosmetics',
        expiry_tracking_enabled: form.productKind === 'cosmetics',
        client_txn_key: clientTxnKey,
      }

      if (isMatrixKind) {
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

      const stockEntries = stockRows
        .filter((r) => r.quantity > 0)
        .map((r) => ({
          branch_id: r.branchId,
          location_id: r.locationId,
          ...(isMatrixKind ? { variant_key: r.variantKey } : {}),
          quantity: r.quantity,
          unit_cost: r.unitCost || Number(form.purchase_price) || 0,
          batch_number: batchNumber.trim() || null,
          expires_at: expiresAt.trim() || null,
        }))

      const presenceRows = stockRows.filter((r) => r.branchId && r.locationId)

      if (stockEntries.length > 0) {
        const first = stockEntries[0]
        if (!first.branch_id || !first.location_id) {
          throw new Error('Select branch and location for opening stock.')
        }
        if (stockEntries.some((e) => e.unit_cost <= 0)) {
          throw new Error('Opening stock requires a unit purchase cost.')
        }
        if (form.productKind === 'cosmetics' && !expiresAt.trim()) {
          throw new Error('Expiry date is required for cosmetics opening stock.')
        }
        payload.opening_stock = stockEntries

        const branchId = first.branch_id
        const variantStock: Record<string, number> = {}
        for (const r of stockRows) variantStock[r.variantKey] = r.quantity
        const branchPrices = buildBranchPricesPayload({
          branchId,
          isMatrix: isMatrixKind,
          variantDrafts,
          variantStock,
          retailPrice: Number(form.selling_price) || 0,
          wholesalePrice: form.wholesale_price ? Number(form.wholesale_price) : null,
          openingQuantity: totalOpeningQty,
        })
        if (branchPrices.length > 0) payload.branch_prices = branchPrices
      }

      const result = await createProductAtomic(payload)
      const id = String(result.product_id)
      const createdVariants =
        (result.variants as Array<{ id: string; key?: string }> | undefined) ?? []

      // Seed zero balance rows so Out-of-stock reporting includes selected branches.
      if (presenceRows.length > 0 && createdVariants.length > 0) {
        const seedItems: Array<{
          variant_id: string
          branch_id: string
          location_id?: string | null
        }> = []
        for (const row of presenceRows) {
          if (isMatrixKind) {
            const match = createdVariants.find((v) => v.key === row.variantKey)
            if (match?.id) {
              seedItems.push({
                variant_id: match.id,
                branch_id: row.branchId,
                location_id: row.locationId,
              })
            }
          } else {
            const vid = createdVariants[0]?.id
            if (vid) {
              seedItems.push({
                variant_id: vid,
                branch_id: row.branchId,
                location_id: row.locationId,
              })
            }
          }
        }
        if (seedItems.length > 0) {
          const { seedInventoryPresence } = await import(
            '@/features/inventory/repositories/inventory-valuation.repository'
          )
          await seedInventoryPresence(seedItems)
        }
      }
      if (pendingCover) {
        await uploadProductImage(orgId, id, pendingCover, { isCover: true })
        setPendingCover(null)
        invalidateStorefrontCache()
      }

      const prices = isMatrixKind
        ? variantDrafts.map((v) => v.selling_price)
        : [Number(form.selling_price) || 0]
      const minP = Math.min(...prices)
      const maxP = Math.max(...prices)
      const priceLabel = minP === maxP ? formatBDT(minP) : `${formatBDT(minP)} – ${formatBDT(maxP)}`

      const barcodeReady = isMatrixKind
        ? variantDrafts.every((v) => Boolean(v.barcode?.trim()))
        : Boolean(form.base_barcode.trim())

      const successPayload: ProductSuccessPayload = {
        productId: id,
        name: form.name.trim(),
        status: String(result.status ?? status),
        variantCount: isMatrixKind ? variantDrafts.length : 1,
        barcodeReady,
        totalOpeningQty,
        priceLabel,
      }

      setPrintItems(
        isMatrixKind
          ? variantDrafts.map((v) => ({
              name: form.name.trim(),
              sku: v.sku,
              barcode: v.barcode,
              price: v.selling_price,
              variant: v.label,
            }))
          : [
              {
                name: form.name.trim(),
                sku: form.base_sku || '—',
                barcode: form.base_barcode,
                price: Number(form.selling_price) || 0,
              },
            ],
      )

      setKeepDefaults({
        category_id: form.category_id,
        brand_id: form.brand_id,
        categoryLabel,
        brandLabel,
        categoryCode,
        brandCode,
      })

      return successPayload
    },
    onSuccess: (payload) => {
      setSuccess(payload)
      if (isEdit) onSaved?.(payload.productId)
      else onCreated?.(payload.productId)
    },
    onError: (e: Error) => onError(e.message),
  })

  if (success) {
    return (
      <div className="product-module px-3 py-6 sm:px-4">
        <ProductSuccessScreen
          result={success}
          title={isEdit ? 'Product Updated Successfully!' : undefined}
          onAddAnother={isEdit ? undefined : resetForAddAnother}
          onPrintBarcode={() => setPrintOpen(true)}
        />
        <BarcodePrintDialog open={printOpen} onOpenChange={setPrintOpen} items={printItems} />
      </div>
    )
  }

  if (!isEdit && (!entryMode || entryMode === 'bulk')) {
    return (
      <div className="product-module mx-auto max-w-5xl space-y-4 px-3 py-4 sm:px-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/products">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Link>
          </Button>
          <h1 className="font-serif text-2xl text-[#111111]">Add New Product</h1>
        </div>
        <ProductEntryModeCards
          value={entryMode}
          onChange={(mode) => {
            setEntryMode(mode)
            setStep('info')
          }}
        />
      </div>
    )
  }

  const stepHint =
    step === 'info'
      ? 'Fill product identity and pricing defaults.'
      : step === 'variants'
        ? isEdit
          ? 'Review existing variants. Add new combinations from the product detail page.'
          : 'Build attribute combinations and review the matrix.'
        : step === 'stock'
          ? isEdit
            ? 'Stock is managed via Inventory Adjustments — not overwritten here.'
            : 'Set opening quantities by location (optional).'
          : isEdit
            ? 'Confirm changes, then save or update lifecycle status.'
            : 'Confirm details, then save draft, submit, or activate.'

  return (
    <div className="product-module mx-auto max-w-6xl space-y-4 px-3 py-4 sm:px-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" type="button" onClick={goBack}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-serif text-2xl text-[#111111]">
              {isEdit ? 'Edit Product' : 'Add New Product'}
            </h1>
            {isEdit && editing?.status ? (
              <ProductStatusBadge status={String(editing.status)} />
            ) : null}
          </div>
          <p className="text-sm text-[#6B7280]">
            {isQuick ? 'Quick Add' : 'Variant Product'} · {PRODUCT_KIND_LABELS[form.productKind]}
          </p>
        </div>
      </div>

      <ProductWizardStepper
        current={step}
        skipVariants={isQuick}
        onStepClick={(s) => {
          const err = validateStep(s)
          if (err) {
            onError(err)
            return
          }
          setStep(s)
        }}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4 rounded-2xl border border-border bg-white p-4 sm:p-6">
          {step === 'info' ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="wiz-name">Product name *</Label>
                <Input
                  id="wiz-name"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>

              {!isQuick && !isEdit ? (
                <div className="space-y-1.5">
                  <Label>Product type</Label>
                  <ProductTypeSelector
                    value={form.productKind}
                    onChange={(productKind: ProductKind) => setForm((f) => ({ ...f, productKind }))}
                  />
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Category *</Label>
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
                <Label htmlFor="wiz-desc">Description</Label>
                <textarea
                  id="wiz-desc"
                  rows={3}
                  className="flex min-h-[80px] w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="wiz-sku">Base SKU</Label>
                  <Input
                    id="wiz-sku"
                    value={form.base_sku}
                    onChange={(e) => {
                      setSkuTouched(true)
                      setForm((f) => ({ ...f, base_sku: e.target.value }))
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wiz-barcode">Barcode</Label>
                  <Input
                    id="wiz-barcode"
                    value={form.base_barcode}
                    inputMode="numeric"
                    maxLength={8}
                    onChange={(e) => {
                      setForm((f) => ({
                        ...f,
                        base_barcode: e.target.value.replace(/\D/g, '').slice(0, 8),
                      }))
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Purchase *</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.purchase_price}
                    onChange={(e) => setForm((f) => ({ ...f, purchase_price: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Retail *</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.selling_price}
                    onChange={(e) => setForm((f) => ({ ...f, selling_price: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Reorder</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.reorder_level}
                    onChange={(e) => setForm((f) => ({ ...f, reorder_level: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Cover image</Label>
                {isEdit && editing ? (
                  <ProductImageUploader
                    orgId={orgId}
                    productId={editing.id}
                    currentUrl={editing.coverUrl}
                  />
                ) : (
                  <>
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
                    {pendingCover ? (
                      <p className="text-xs text-[#6B7280]">Selected: {pendingCover.name}</p>
                    ) : null}
                  </>
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
            </div>
          ) : null}

          {step === 'variants' && !isQuick ? (
            isEdit ? (
              <div className="space-y-3">
                <p className="text-sm text-[#6B7280]">
                  Existing variants from catalog SSOT. Stock and new combinations stay on inventory /
                  product detail flows.
                </p>
                {existingVariants.length === 0 ? (
                  <p className="text-sm text-[#6B7280]">No variants loaded.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[#FFF1F2] text-left text-xs text-[#6B7280]">
                        <tr>
                          <th className="px-3 py-2">Variant</th>
                          <th className="px-3 py-2">SKU</th>
                          <th className="px-3 py-2">Barcode</th>
                          <th className="px-3 py-2">Retail</th>
                          <th className="px-3 py-2">Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {existingVariants.map((v) => (
                          <tr key={v.id} className="border-t border-border">
                            <td className="px-3 py-2">{v.name || '—'}</td>
                            <td className="px-3 py-2 font-mono text-xs">{v.sku || '—'}</td>
                            <td className="px-3 py-2 font-mono text-xs">{v.barcode || '—'}</td>
                            <td className="px-3 py-2 tabular-nums">
                              {formatBDT(Number(v.selling_price) || 0)}
                            </td>
                            <td className="px-3 py-2 tabular-nums">{v.stockQty ?? 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <VariantMatrixBuilder
                  kind={form.productKind}
                  sizes={sizes}
                  colors={colors}
                  onSizesChange={setSizes}
                  onColorsChange={setColors}
                  variantCount={variantDrafts.length}
                />
                <VariantPricingMatrix
                  variants={variantDrafts}
                  onChange={setVariantOverrides}
                  onBulkPurchase={(price) =>
                    setVariantOverrides(variantDrafts.map((v) => ({ ...v, purchase_price: price })))
                  }
                  onBulkRetail={(price) =>
                    setVariantOverrides(variantDrafts.map((v) => ({ ...v, selling_price: price })))
                  }
                />
              </div>
            )
          ) : null}

          {step === 'stock' ? (
            isEdit ? (
              <div className="space-y-3 rounded-xl border border-[#FECDD3] bg-[#FFF1F2]/60 p-4">
                <p className="text-sm text-[#9F1239]">
                  Current on-hand:{' '}
                  <span className="font-semibold tabular-nums">
                    {existingVariants.reduce((s, v) => s + Number(v.stockQty ?? 0), 0)} pcs
                  </span>
                </p>
                <p className="text-sm text-[#6B7280]">
                  Opening stock is create-only. Adjust inventory through the inventory module so ledger
                  SSOT stays intact.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/inventory/adjustments">Open inventory adjustments</Link>
                </Button>
              </div>
            ) : (
              <BranchStockMatrix
                variants={stockVariants}
                rows={stockRows}
                onRowsChange={setStockRows}
                requiresExpiry={form.productKind === 'cosmetics'}
                batchNumber={batchNumber}
                expiresAt={expiresAt}
                onBatchChange={(b, e) => {
                  setBatchNumber(b)
                  setExpiresAt(e)
                }}
              />
            )
          ) : null}

          {step === 'review' ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#FECDD3] bg-[#FFF1F2]/60 p-4">
                <h3 className="font-serif text-xl text-[#111111]">{form.name.trim() || '—'}</h3>
                <p className="mt-1 text-sm text-[#6B7280]">
                  {[categoryLabel, brandLabel].filter(Boolean).join(' · ') || 'No category/brand'}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Metric
                    label="Variants"
                    value={String(
                      isEdit
                        ? existingVariants.length || (editing?.variantCount ?? 1)
                        : isMatrixKind
                          ? variantDrafts.length
                          : 1,
                    )}
                  />
                  <Metric
                    label="Barcodes"
                    value={
                      isEdit
                        ? String(
                            existingVariants.length > 0
                              ? existingVariants.filter((v) => v.barcode).length
                              : form.base_barcode
                                ? 1
                                : 0,
                          )
                        : isMatrixKind
                          ? String(variantDrafts.filter((v) => v.barcode).length)
                          : form.base_barcode
                            ? '1'
                            : '0'
                    }
                  />
                  <Metric
                    label={isEdit ? 'On-hand stock' : 'Opening stock'}
                    value={`${
                      isEdit
                        ? existingVariants.reduce((s, v) => s + Number(v.stockQty ?? 0), 0)
                        : totalOpeningQty
                    } pcs`}
                  />
                  <Metric
                    label="Retail"
                    value={
                      isEdit && existingVariants.length > 0
                        ? (() => {
                            const prices = existingVariants.map((v) => Number(v.selling_price) || 0)
                            const minP = Math.min(...prices)
                            const maxP = Math.max(...prices)
                            return minP === maxP
                              ? formatBDT(minP)
                              : `${formatBDT(minP)} – ${formatBDT(maxP)}`
                          })()
                        : isMatrixKind && variantDrafts.length
                          ? (() => {
                              const prices = variantDrafts.map((v) => v.selling_price)
                              const minP = Math.min(...prices)
                              const maxP = Math.max(...prices)
                              return minP === maxP
                                ? formatBDT(minP)
                                : `${formatBDT(minP)} – ${formatBDT(maxP)}`
                            })()
                          : formatBDT(Number(form.selling_price) || 0)
                    }
                  />
                </div>
              </div>
              {!form.category_id ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Category is required before activation for POS.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={goBack}>
              {step === 'info' ? (isEdit ? 'Cancel' : 'Change mode') : 'Back'}
            </Button>
            <div className="flex flex-wrap gap-2">
              {step !== 'review' ? (
                <Button type="button" className={PM.btn} onClick={goNext}>
                  Next
                </Button>
              ) : (
                <>
                  {isEdit ? (
                    <Button
                      type="button"
                      className={PM.btn}
                      disabled={saveMutation.isPending}
                      onClick={() => saveMutation.mutate('save')}
                    >
                      {saveMutation.isPending ? (
                        <>
                          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                          Saving…
                        </>
                      ) : (
                        'Save Changes'
                      )}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={saveMutation.isPending}
                      onClick={() => saveMutation.mutate('draft')}
                    >
                      Save Draft
                    </Button>
                  )}
                  <PermissionGate permission="products.submit">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={saveMutation.isPending}
                      onClick={() => saveMutation.mutate('submit')}
                    >
                      Submit for Approval
                    </Button>
                  </PermissionGate>
                  {(canApprove || canCreate) && (
                    <Button
                      type="button"
                      className={isEdit ? undefined : PM.btn}
                      variant={isEdit ? 'outline' : 'default'}
                      disabled={saveMutation.isPending || !form.category_id}
                      onClick={() => saveMutation.mutate('activate')}
                    >
                      {saveMutation.isPending && !isEdit ? (
                        <>
                          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                          Saving…
                        </>
                      ) : (
                        'Activate Product'
                      )}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <ProductSummaryPanel
          name={form.name}
          productTypeLabel={PRODUCT_KIND_LABELS[form.productKind]}
          categoryLabel={categoryLabel}
          brandLabel={brandLabel}
          baseSku={form.base_sku}
          baseBarcode={form.base_barcode}
          variantCount={
            isEdit
              ? existingVariants.length || (editing?.variantCount ?? 1)
              : isMatrixKind
                ? variantDrafts.length
                : 1
          }
          purchasePrice={Number(form.purchase_price) || 0}
          sellingPrice={Number(form.selling_price) || 0}
          totalOpeningQty={
            isEdit
              ? existingVariants.reduce((s, v) => s + Number(v.stockQty ?? 0), 0)
              : totalOpeningQty
          }
          stepHint={stepHint}
        />
      </div>

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
          const row = await createSubcategory(orgId, {
            name,
            category_id: categoryId!,
            is_active: true,
          })
          return {
            id: row.id,
            label: row.name,
            meta: { categoryId: categoryId ?? undefined },
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className={cn('rounded-xl bg-white p-3 shadow-sm')}>
      <p className="text-xs text-[#E11D48]">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-[#111111]">{value}</p>
    </div>
  )
}
