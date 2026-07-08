import { cn } from '@/lib/utils'
import type { ProductColor, ProductSize } from '../utils/product-variants'

interface ProductVariantSelectorProps {
  sizes: ProductSize[]
  colors: ProductColor[]
  disabledSizes: ProductSize[]
  selectedSize?: ProductSize
  selectedColor?: ProductColor
  onSizeChange: (size: ProductSize) => void
  onColorChange: (color: ProductColor) => void
}

const COLOR_SWATCHES: Record<ProductColor, string> = {
  Black: 'bg-[#111111]',
  White: 'bg-white border border-[#111111]/15',
  Red: 'bg-[#E11D48]',
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
                    disabled && 'cursor-not-allowed border-[#111111]/10 text-[#6B7280]/50 line-through',
                    !disabled && selectedSize === size
                      ? 'border-[#111111] bg-[#111111] text-white'
                      : !disabled && 'border-[#111111]/15 text-[#111111] hover:border-[#111111]',
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
                  selectedColor === color ? 'ring-2 ring-[#111111] ring-offset-2' : 'ring-0',
                )}
                aria-label={color}
              >
                <span className={cn('block h-full w-full rounded-full', COLOR_SWATCHES[color])} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
