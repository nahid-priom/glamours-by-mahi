import { useId, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'
import type { SupplierProfileTab } from '../types/supplier-360.types'

const TABS: { id: SupplierProfileTab; label: string }[] = [
  { id: 'ledger', label: 'Supplier ledger' },
  { id: 'stock', label: 'Supplier stock' },
  { id: 'details', label: 'Supplier details' },
]

type Props = {
  value: SupplierProfileTab
  onChange: (tab: SupplierProfileTab) => void
  panelIdPrefix?: string
}

export function SupplierProfileTabs({ value, onChange, panelIdPrefix }: Props) {
  const baseId = useId()
  const panelPrefix = panelIdPrefix ?? baseId

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      onChange(TABS[(index + 1) % TABS.length].id)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      onChange(TABS[(index - 1 + TABS.length) % TABS.length].id)
    } else if (e.key === 'Home') {
      e.preventDefault()
      onChange(TABS[0].id)
    } else if (e.key === 'End') {
      e.preventDefault()
      onChange(TABS[TABS.length - 1].id)
    }
  }

  return (
    <div
      role="tablist"
      aria-label="Supplier profile sections"
      className="flex flex-wrap gap-1 rounded-xl border border-border bg-white p-1"
    >
      {TABS.map((tab, index) => {
        const selected = value === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`${baseId}-${tab.id}`}
            aria-selected={selected}
            aria-controls={`${panelPrefix}-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            className={cn(
              'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              selected
                ? 'bg-[#2563EB] text-white shadow-sm'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => onKeyDown(e, index)}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export function supplierTabPanelId(baseId: string, tab: SupplierProfileTab): string {
  return `${baseId}-panel-${tab}`
}