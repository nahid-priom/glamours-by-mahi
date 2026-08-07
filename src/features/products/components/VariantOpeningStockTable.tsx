import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { AppDateField } from '@/components/date-picker'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { queryKeys } from '@/lib/query/keys'
import { listAccessibleBranches } from '@/features/inventory/repositories/inventory-valuation.repository'
import { listStockLocations } from '@/features/inventory/repositories/inventory.repository'
import { MoneyValue } from '@/features/inventory/components/InventoryValuationUi'
import type { VariantDraft } from '../lib/variant-matrix'
import { VariantImageUploader } from './VariantImageUploader'

export type VariantOpeningStockMeta = {
  branchId: string
  locationId: string
  unitCost: number
  batchNumber?: string
  expiresAt?: string
}

type Props = {
  variants: VariantDraft[]
  quantities: Record<string, number>
  meta: VariantOpeningStockMeta
  onMetaChange: (next: VariantOpeningStockMeta) => void
  onQuantityChange: (variantKey: string, quantity: number) => void
  purchasePrice: number
  sellingPrice: number
  requiresExpiry?: boolean
  disabled?: boolean
  pendingImages?: Record<string, File | null>
  onPendingImageChange?: (variantKey: string, file: File | null) => void
}

const ROW_STAGGER_MS = 70

export function VariantOpeningStockTable({
  variants,
  quantities,
  meta,
  onMetaChange,
  onQuantityChange,
  purchasePrice,
  sellingPrice,
  requiresExpiry = false,
  disabled,
  pendingImages,
  onPendingImageChange,
}: Props) {
  const variantSignature = useMemo(() => variants.map((v) => v.key).join('|'), [variants])
  const [visibleCount, setVisibleCount] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)
  const showImages = Boolean(onPendingImageChange)

  const { data: branches = [] } = useQuery({
    queryKey: queryKeys.branches,
    queryFn: listAccessibleBranches,
  })

  const { data: locations = [] } = useQuery({
    queryKey: queryKeys.stockLocations(meta.branchId),
    queryFn: () => listStockLocations(meta.branchId),
    enabled: Boolean(meta.branchId),
  })

  const saleableLocations = locations.filter(
    (l) => l.location_type === 'saleable' && l.is_active && !l.deleted_at,
  )

  useEffect(() => {
    if (!variants.length) {
      setVisibleCount(0)
      setIsGenerating(false)
      return
    }

    setIsGenerating(true)
    setVisibleCount(0)

    const timers: ReturnType<typeof setTimeout>[] = []
    variants.forEach((_, index) => {
      timers.push(
        setTimeout(() => {
          setVisibleCount(index + 1)
        }, ROW_STAGGER_MS * (index + 1)),
      )
    })
    timers.push(
      setTimeout(() => {
        setIsGenerating(false)
      }, ROW_STAGGER_MS * variants.length + 40),
    )

    return () => timers.forEach(clearTimeout)
  }, [variantSignature, variants.length])

  const totals = useMemo(() => {
    let totalQty = 0
    for (const variant of variants) {
      totalQty += quantities[variant.key] ?? 0
    }
    const unitCost = meta.unitCost || purchasePrice
    return {
      totalQty,
      totalCost: totalQty * unitCost,
      totalValue: totalQty * sellingPrice,
    }
  }, [variants, quantities, meta.unitCost, purchasePrice, sellingPrice])

  if (!variants.length) return null

  const gridClass = showImages
    ? 'grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,0.8fr)_5rem] sm:grid-cols-[3.5rem_minmax(0,1.2fr)_minmax(0,1fr)_5rem]'
    : 'grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_5rem] sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_5rem]'

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-border bg-[#FAFAFA] p-3 sm:p-4">
      <div>
        <p className="text-sm font-semibold text-[#111827]">Variant opening stock</p>
        <p className="text-xs text-[#6B7280]">
          Select branch and enter opening quantity per variant.
          {requiresExpiry ? ' Cosmetics products require batch and expiry date.' : ''}
          {showImages ? ' Optional image per variant uploads after save.' : ''}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <Label className="text-xs">Branch</Label>
          <select
            className="flex h-9 w-full rounded-md border border-border bg-white px-2.5 text-sm"
            disabled={disabled}
            value={meta.branchId}
            onChange={(e) => onMetaChange({ ...meta, branchId: e.target.value, locationId: '' })}
          >
            <option value="">Select branch</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Location</Label>
          <select
            className="flex h-9 w-full rounded-md border border-border bg-white px-2.5 text-sm"
            disabled={disabled || !meta.branchId}
            value={meta.locationId}
            onChange={(e) => onMetaChange({ ...meta, locationId: e.target.value })}
          >
            <option value="">Select location</option>
            {saleableLocations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Unit cost (৳)</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            className="h-9"
            disabled={disabled}
            value={meta.unitCost || ''}
            onChange={(e) =>
              onMetaChange({ ...meta, unitCost: Math.max(0, Number(e.target.value) || 0) })
            }
          />
        </div>
        {requiresExpiry ? (
          <>
            <div className="space-y-1">
              <Label className="text-xs">Batch</Label>
              <Input
                className="h-9"
                disabled={disabled}
                value={meta.batchNumber ?? ''}
                onChange={(e) => onMetaChange({ ...meta, batchNumber: e.target.value })}
                placeholder="BATCH-001"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Expiry</Label>
              <AppDateField
                disabled={disabled}
                value={meta.expiresAt ?? ''}
                onChange={(ymd) => onMetaChange({ ...meta, expiresAt: ymd })}
                clearable
              />
            </div>
          </>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-white">
        <div
          className={`grid ${gridClass} gap-2 border-b border-border bg-[#F8F6F2] px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF]`}
        >
          {showImages ? <span>Img</span> : null}
          <span>Variant</span>
          <span className="hidden sm:inline">SKU</span>
          <span className="text-right">Qty</span>
        </div>

        <div className="max-h-56 divide-y divide-border overflow-y-auto">
          {isGenerating && visibleCount === 0 ? (
            <div className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-[#6B7280]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating variants…
            </div>
          ) : null}

          {variants.slice(0, visibleCount).map((variant) => (
            <div
              key={variant.key}
              className={`grid ${gridClass} items-center gap-2 px-2.5 py-1.5 text-sm`}
            >
              {showImages ? (
                <VariantImageUploader
                  compact
                  disabled={disabled}
                  pendingFile={pendingImages?.[variant.key] ?? null}
                  onPendingFileChange={(file) => onPendingImageChange?.(variant.key, file)}
                />
              ) : null}
              <div className="min-w-0">
                <p className="truncate font-medium text-[#111827]">{variant.label}</p>
                <p className="truncate text-[10px] text-[#9CA3AF] sm:hidden">{variant.sku}</p>
              </div>
              <p className="hidden truncate text-xs text-[#6B7280] sm:block">{variant.sku}</p>
              <Input
                type="number"
                min={0}
                step="1"
                className="h-8 text-right"
                disabled={disabled}
                value={quantities[variant.key] || ''}
                onChange={(e) =>
                  onQuantityChange(variant.key, Math.max(0, Number(e.target.value) || 0))
                }
              />
            </div>
          ))}

          {isGenerating && visibleCount < variants.length
            ? Array.from({ length: variants.length - visibleCount }).map((_, i) => (
                <div
                  key={`loading-${i}`}
                  className="flex items-center gap-2 px-2.5 py-2 text-xs text-[#9CA3AF]"
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span className="h-3 flex-1 animate-pulse rounded bg-[#F3F4F6]" />
                </div>
              ))
            : null}
        </div>
      </div>

      {totals.totalQty > 0 ? (
        <div className="grid grid-cols-2 gap-2 rounded-md bg-white p-2.5 text-sm sm:grid-cols-4">
          <div>
            <p className="text-[10px] uppercase text-[#9CA3AF]">Variants</p>
            <p className="font-semibold">{variants.length}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-[#9CA3AF]">Total qty</p>
            <p className="font-semibold">{totals.totalQty}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-[#9CA3AF]">Opening cost</p>
            <p className="font-semibold">
              <MoneyValue amount={totals.totalCost} />
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-[#9CA3AF]">Selling value</p>
            <p className="font-semibold">
              <MoneyValue amount={totals.totalValue} />
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
