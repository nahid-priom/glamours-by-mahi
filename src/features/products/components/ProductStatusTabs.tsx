import { cn } from '@/lib/utils'
import type { ProductCatalogFilters, ProductLifecycleStatus } from '../lib/product-filters'
import { PM } from '../lib/product-module-theme'

const TABS: Array<{ value: ProductLifecycleStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All Products' },
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'archived', label: 'Archived' },
]

type Props = {
  filters: ProductCatalogFilters
  onChange: (next: ProductCatalogFilters) => void
}

export function ProductStatusTabs({ filters, onChange }: Props) {
  const current = filters.status ?? 'all'
  return (
    <div className="product-module flex gap-1 overflow-x-auto rounded-xl border border-border bg-white p-1">
      {TABS.map((tab) => {
        const active = current === tab.value
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() =>
              onChange({
                ...filters,
                status: tab.value,
                stock: tab.value === 'draft' ? 'drafts' : tab.value === 'pending_approval' ? 'pending' : filters.stock === 'drafts' || filters.stock === 'pending' ? 'all' : filters.stock,
                page: 1,
              })
            }
            className={cn(
              'shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm',
              active
                ? `${PM.btn} shadow-sm`
                : 'text-[#6B7280] hover:bg-[#FFF1F2] hover:text-[#9F1239]',
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
