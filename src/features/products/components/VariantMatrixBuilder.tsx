import { memo, useState } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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

function CustomValueRow({
  placeholder,
  onAdd,
}: {
  placeholder: string
  onAdd: (value: string) => void
}) {
  const [value, setValue] = useState('')
  const commit = () => {
    const trimmed = value.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setValue('')
  }
  return (
    <div className="mt-2 flex gap-2">
      <Input
        value={value}
        placeholder={placeholder}
        className="h-8 text-xs"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          }
        }}
      />
      <Button type="button" size="sm" variant="outline" className="h-8 shrink-0" onClick={commit}>
        <Plus className="mr-1 h-3.5 w-3.5" />
        Add
      </Button>
    </div>
  )
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

  const customSizes = sizes.filter((s) => !sizePresets.includes(s))
  const customColors = colors.filter((c) => !colorPresets.includes(c))

  return (
    <div className="space-y-4 rounded-xl border border-border bg-[#FAFAF9] p-4">
      <div>
        <p className="text-sm font-semibold text-[#111111]">
          {kind === 'cosmetics' ? 'Shade & Volume' : 'Size & Color'} Matrix
        </p>
        <p className="text-xs text-[#6B7280]">
          Select options — {variantCount} variant{variantCount === 1 ? '' : 's'} will be created.
        </p>
        {variantCount === 0 ? (
          <p className="mt-1 text-xs font-medium text-[#E11D48]">
            Select at least one size/volume and one color/shade to generate variants.
          </p>
        ) : null}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
          {kind === 'cosmetics' ? 'Volume' : 'Sizes'}
        </p>
        <div className="flex flex-wrap gap-2">
          {[...sizePresets, ...customSizes].map((size) => (
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
        <CustomValueRow
          placeholder={kind === 'cosmetics' ? 'Custom volume…' : 'Custom size…'}
          onAdd={(v) => {
            if (!sizes.includes(v)) onSizesChange([...sizes, v])
          }}
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
          {kind === 'cosmetics' ? 'Shades' : 'Colors'}
        </p>
        <div className="flex flex-wrap gap-2">
          {[...colorPresets, ...customColors].map((color) => (
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
        <CustomValueRow
          placeholder={kind === 'cosmetics' ? 'Custom shade…' : 'Custom color…'}
          onAdd={(v) => {
            if (!colors.includes(v)) onColorsChange([...colors, v])
          }}
        />
      </div>
    </div>
  )
})
