import { Check, FileSpreadsheet, Layers, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PM, type ProductEntryMode } from '../../lib/product-module-theme'

type Props = {
  value: ProductEntryMode | null
  onChange: (mode: ProductEntryMode) => void
}

const MODES: Array<{
  id: ProductEntryMode
  title: string
  description: string
  icon: typeof Zap
  recommended?: boolean
}> = [
  {
    id: 'quick',
    title: 'Quick Add',
    description: 'Add a single product with one default variant. Fastest path for ordinary items.',
    icon: Zap,
  },
  {
    id: 'variant',
    title: 'Variant Product',
    description: 'Multiple sizes, colors, or shades with a generated variant matrix.',
    icon: Layers,
    recommended: true,
  },
  {
    id: 'bulk',
    title: 'Bulk Add / Import',
    description: 'Spreadsheet-style CSV import for many products at once.',
    icon: FileSpreadsheet,
  },
]

export function ProductEntryModeCards({ value, onChange }: Props) {
  return (
    <div className="product-module space-y-4">
      <h2 className="font-serif text-2xl text-[#111111]">Choose entry mode</h2>
      <div className="grid gap-3 md:grid-cols-3">
        {MODES.map((mode) => {
          const Icon = mode.icon
          const selected = value === mode.id
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onChange(mode.id)}
              className={cn(
                'relative rounded-2xl border p-4 text-left transition',
                selected ? PM.cardActive : PM.cardIdle,
              )}
            >
              {selected ? (
                <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[#E11D48] text-white">
                  <Check className="h-3.5 w-3.5" />
                </span>
              ) : mode.recommended ? (
                <span className={cn('absolute right-3 top-3', PM.chip)}>Recommended</span>
              ) : null}
              <div
                className={cn(
                  'mb-3 flex h-10 w-10 items-center justify-center rounded-xl',
                  selected ? 'bg-[#E11D48] text-white' : 'bg-slate-100 text-slate-600',
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-[#111111]">{mode.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-[#6B7280]">{mode.description}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
