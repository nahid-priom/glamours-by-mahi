import { cn } from '@/lib/utils'
import type { InventoryView } from '../lib/inventory-filters'
import { INVENTORY_VIEWS } from '../lib/inventory-filters'

type Props = {
  value: InventoryView
  onChange: (view: InventoryView) => void
  className?: string
}

export function InventoryViewSwitcher({ value, onChange, className }: Props) {
  return (
    <div className={cn('inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1', className)}>
      {INVENTORY_VIEWS.map((view) => (
        <button
          key={view.value}
          type="button"
          onClick={() => onChange(view.value)}
          className={cn(
            'h-9 rounded-lg px-3 text-sm font-medium transition-colors',
            value === view.value
              ? 'bg-white text-[#111827] shadow-sm'
              : 'text-[#6B7280] hover:text-[#111827]',
          )}
        >
          {view.label}
        </button>
      ))}
    </div>
  )
}
