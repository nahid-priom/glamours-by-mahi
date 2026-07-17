import { cn } from '@/lib/utils'
import type { VariantSelection } from '../hooks/useVariantSelection'

const COLOR_SWATCHES: Record<string, string> = {
  black: 'bg-[#22171C]',
  white: 'bg-white border border-[#22171C]/15',
  red: 'bg-[#E11D48]',
  pink: 'bg-[#FF3F7F]',
  blue: 'bg-[#2563EB]',
  green: 'bg-[#16A34A]',
  beige: 'bg-[#E8DCC8]',
  brown: 'bg-[#8B5E3C]',
  grey: 'bg-[#9CA3AF]',
  gray: 'bg-[#9CA3AF]',
  purple: 'bg-[#7C3AED]',
  yellow: 'bg-[#FACC15]',
  orange: 'bg-[#F97316]',
}

function isColorAttribute(name: string): boolean {
  const lowered = name.toLowerCase()
  return lowered.includes('color') || lowered.includes('colour') || lowered.includes('shade')
}

interface VariantAttributePickerProps {
  selection: VariantSelection
  compact?: boolean
}

/**
 * Generic option picker driven entirely by the product's configured
 * attributes (size, color, weight, volume, style, material, …).
 */
export function VariantAttributePicker({ selection, compact = false }: VariantAttributePickerProps) {
  const { attributes, selected, selectValue, availability } = selection

  if (attributes.length === 0) return null

  return (
    <div className={compact ? 'space-y-4' : 'space-y-5'}>
      {attributes.map((attribute) => {
        const values = availability(attribute.name)
        const chosen = selected[attribute.name]
        const colorLike = isColorAttribute(attribute.name)

        return (
          <div key={attribute.name}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6B7280]">
              {attribute.name}
              {chosen ? `: ${chosen}` : ''}
            </p>
            <div className={cn('mt-2.5 flex flex-wrap', colorLike ? 'gap-3' : 'gap-2')}>
              {values.map(({ value, disabled }) => {
                const swatch = colorLike ? COLOR_SWATCHES[value.toLowerCase()] : undefined
                if (colorLike && swatch) {
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={disabled}
                      onClick={() => selectValue(attribute.name, value)}
                      className={cn(
                        'h-9 w-9 rounded-full p-0.5 transition',
                        chosen === value ? 'ring-2 ring-[#22171C] ring-offset-2' : 'ring-0',
                        disabled && 'cursor-not-allowed opacity-35',
                      )}
                      aria-label={`${attribute.name} ${value}`}
                      title={disabled ? 'Out of stock' : value}
                    >
                      <span className={cn('block h-full w-full rounded-full', swatch)} />
                    </button>
                  )
                }
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={disabled}
                    onClick={() => selectValue(attribute.name, value)}
                    className={cn(
                      'min-w-[44px] rounded-full border px-3 py-2 text-xs font-semibold transition',
                      disabled &&
                        'cursor-not-allowed border-[#22171C]/10 text-[#6B7280]/50 line-through',
                      !disabled && chosen === value
                        ? 'border-[#22171C] bg-[#22171C] text-white'
                        : !disabled &&
                            'border-[#22171C]/15 text-[#22171C] hover:border-[#22171C]',
                    )}
                    title={disabled ? 'Out of stock' : undefined}
                  >
                    {value}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
