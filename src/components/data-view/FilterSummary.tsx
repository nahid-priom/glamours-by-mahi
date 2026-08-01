import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type FilterChip = {
  id: string
  label: string
  onRemove?: () => void
}

interface FilterSummaryProps {
  chips: FilterChip[]
  trailing?: ReactNode
  onClearAll?: () => void
}

export function FilterSummary({ chips, trailing, onClearAll }: FilterSummaryProps) {
  if (!chips.length && !trailing) return null

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {chips.map((chip) => (
        <span
          key={chip.id}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-slate-50 px-2.5 py-1"
        >
          {chip.label}
          {chip.onRemove ? (
            <button
              type="button"
              onClick={chip.onRemove}
              className="rounded-full p-0.5 hover:bg-slate-200"
              aria-label={`Remove ${chip.label}`}
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </span>
      ))}
      {onClearAll && chips.length > 1 ? (
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onClearAll}>
          Clear filters
        </Button>
      ) : null}
      {trailing}
    </div>
  )
}
