import { memo } from 'react'
import { cn } from '@/lib/utils'
import {
  COLOR_PRESETS,
  PRODUCT_KIND_LABELS,
  SHADE_PRESETS,
  SIZE_PRESETS,
  VOLUME_PRESETS,
  type ProductKind,
} from '@/config/catalog'

interface ProductTypeSelectorProps {
  value: ProductKind
  onChange: (kind: ProductKind) => void
}

const KINDS: ProductKind[] = ['simple', 'size_color', 'cosmetics', 'bundle', 'service']

export const ProductTypeSelector = memo(function ProductTypeSelector({
  value,
  onChange,
}: ProductTypeSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {KINDS.map((kind) => (
        <button
          key={kind}
          type="button"
          onClick={() => onChange(kind)}
          className={cn(
            'rounded-xl border px-3 py-2.5 text-left text-sm transition',
            value === kind
              ? 'border-[#111111] bg-[#111111] text-white'
              : 'border-border bg-white text-[#111111] hover:border-[#111111]/40',
          )}
        >
          <span className="font-medium">{PRODUCT_KIND_LABELS[kind]}</span>
        </button>
      ))}
    </div>
  )
})

interface VariantMatrixBuilderProps {
  kind: ProductKind
  sizes: string[]
  colors: string[]
  onSizesChange: (sizes: string[]) => void
  onColorsChange: (colors: string[]) => void
  variantCount: number
}

function toggle(list: string[], item: string): string[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
}

export const VariantMatrixBuilder = memo(function VariantMatrixBuilder({
  kind,
  sizes,
  colors,
  onSizesChange,
  onColorsChange,
  variantCount,
}: VariantMatrixBuilderProps) {
  if (kind === 'simple' || kind === 'bundle' || kind === 'service') return null

  const sizePresets =
    kind === 'cosmetics'
      ? [...VOLUME_PRESETS]
      : [...SIZE_PRESETS.apparel, ...SIZE_PRESETS.free, ...SIZE_PRESETS.numeric]

  const colorPresets = kind === 'cosmetics' ? [...SHADE_PRESETS, ...COLOR_PRESETS] : [...COLOR_PRESETS]

  return (
    <div className="space-y-4 rounded-xl border border-border bg-[#FAFAF9] p-4">
      <div>
        <p className="text-sm font-semibold text-[#111111]">
          {kind === 'cosmetics' ? 'Shade & Volume' : 'Size & Color'} Matrix
        </p>
        <p className="text-xs text-[#6B7280]">
          Select options — {variantCount} variant{variantCount === 1 ? '' : 's'} will be created.
        </p>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
          {kind === 'cosmetics' ? 'Volume' : 'Sizes'}
        </p>
        <div className="flex flex-wrap gap-2">
          {sizePresets.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => onSizesChange(toggle(sizes, size))}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition',
                sizes.includes(size)
                  ? 'border-[#111111] bg-[#111111] text-white'
                  : 'border-border bg-white text-[#111111]',
              )}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
          {kind === 'cosmetics' ? 'Shades' : 'Colors'}
        </p>
        <div className="flex flex-wrap gap-2">
          {colorPresets.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onColorsChange(toggle(colors, color))}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition',
                colors.includes(color)
                  ? 'border-[#111111] bg-[#111111] text-white'
                  : 'border-border bg-white text-[#111111]',
              )}
            >
              {color}
            </button>
          ))}
        </div>
      </div>

      {variantCount === 0 ? (
        <p className="text-xs text-[#E11D48]">Select at least one size and one color to create variants.</p>
      ) : null}
    </div>
  )
})
