import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/format'
import { UNCATEGORIZED_CATEGORY_ID } from '../lib/product-list-model'
import type { CategoryProductCount } from '../repositories/catalog.repository'

export type CategorySidebarSelection = string | null

type Props = {
  totalCount: number
  uncategorizedCount: number
  categories: CategoryProductCount[]
  selected: CategorySidebarSelection
  onSelect: (categoryId: CategorySidebarSelection) => void
  className?: string
}

function SidebarButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean
  label: string
  count: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition',
        active
          ? 'bg-[#111111] font-medium text-white'
          : 'text-[#374151] hover:bg-slate-100',
      )}
    >
      <span className="truncate">{label}</span>
      <span
        className={cn(
          'shrink-0 rounded-full px-2 py-0.5 text-xs tabular-nums',
          active ? 'bg-white/20 text-white' : 'bg-slate-100 text-[#6B7280]',
        )}
      >
        {formatNumber(count)}
      </span>
    </button>
  )
}

export function CategorySidebar({
  totalCount,
  uncategorizedCount,
  categories,
  selected,
  onSelect,
  className,
}: Props) {
  const isAll = !selected
  const isUncategorized = selected === UNCATEGORIZED_CATEGORY_ID

  return (
    <nav className={cn('space-y-1', className)} aria-label="Product categories">
      <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
        Categories
      </p>
      <SidebarButton
        active={isAll}
        label="All products"
        count={totalCount}
        onClick={() => onSelect(null)}
      />
      {categories.map((cat) => (
        <SidebarButton
          key={cat.categoryId}
          active={selected === cat.categoryId}
          label={cat.categoryName}
          count={cat.productCount}
          onClick={() => onSelect(cat.categoryId)}
        />
      ))}
      {uncategorizedCount > 0 ? (
        <SidebarButton
          active={isUncategorized}
          label="Uncategorized"
          count={uncategorizedCount}
          onClick={() => onSelect(UNCATEGORIZED_CATEGORY_ID)}
        />
      ) : null}
    </nav>
  )
}
