import { cn } from '@/lib/utils'

interface ProductVariantSelectorProps {
  sizes: string[]
  colors: string[]
  disabledSizes: string[]
  selectedSize?: string
  selectedColor?: string
  onSizeChange: (size: string) => void
  onColorChange: (color: string) => void
}

const COLOR_SWATCHES: Record<string, string> = {
  Black: 'bg-[#22171C]',
  White: 'bg-white border border-[#22171C]/15',
  Red: 'bg-[#FF3F7F]',
  Blue: 'bg-[#2563EB]',
  Beige: 'bg-[#E8DCC8]',
}

export function ProductVariantSelector({
  sizes,
  colors,
  disabledSizes,
  selectedSize,
  selectedColor,
  onSizeChange,
  onColorChange,
}: ProductVariantSelectorProps) {
  if (sizes.length === 0 && colors.length === 0) return null

  return (
    <div className="space-y-5">
      {sizes.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6B7280]">Size</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {sizes.map((size) => {
              const disabled = disabledSizes.includes(size)
              return (
                <button
                  key={size}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSizeChange(size)}
                  className={cn(
                    'min-w-[44px] rounded-full border px-3 py-2 text-xs font-semibold transition',
                    disabled && 'cursor-not-allowed border-[#22171C]/10 text-[#6B7280]/50 line-through',
                    !disabled && selectedSize === size
                      ? 'border-[#22171C] bg-[#22171C] text-white'
                      : !disabled && 'border-[#22171C]/15 text-[#22171C] hover:border-[#22171C]',
                  )}
                >
                  {size}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {colors.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6B7280]">
            Color{selectedColor ? `: ${selectedColor}` : ''}
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            {colors.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => onColorChange(color)}
                className={cn(
                  'h-9 w-9 rounded-full p-0.5 transition',
                  selectedColor === color ? 'ring-2 ring-[#22171C] ring-offset-2' : 'ring-0',
                )}
                aria-label={color}
              >
                <span
                  className={cn(
                    'block h-full w-full rounded-full',
                    COLOR_SWATCHES[color] ?? 'bg-slate-300 border border-[#22171C]/15',
                  )}
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
