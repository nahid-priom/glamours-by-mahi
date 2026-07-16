import { ArrowUpDown } from 'lucide-react'
import { STOREFRONT_CATEGORIES } from '@/lib/constants'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { StorefrontFilters } from '../storefront.types'
import { DEFAULT_SHOP_FILTERS } from '../lib/shop-utils'

interface FilterDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filters: StorefrontFilters
  onChange: (filters: StorefrontFilters) => void
  focus?: 'filter' | 'sort'
}

const SORT_OPTIONS: { value: NonNullable<StorefrontFilters['sort']>; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
]

export function FilterDrawer({ open, onOpenChange, filters, onChange, focus = 'filter' }: FilterDrawerProps) {
  const reset = () => onChange({ ...DEFAULT_SHOP_FILTERS, search: filters.search })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto rounded-t-[28px] px-0 pb-8">
        <SheetHeader className="border-b border-[#22171C]/5 px-6 pb-4">
          <SheetTitle className="font-serif text-xl">
            {focus === 'sort' ? 'Sort Products' : 'Filter & Sort'}
          </SheetTitle>
          <SheetDescription>Refine your collection</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-6 pt-6">
          <div>
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.25em] text-[#6B7280]">
              Category
            </label>
            <select
              value={filters.category ?? 'all'}
              onChange={(e) =>
                onChange({ ...filters, category: e.target.value as StorefrontFilters['category'], page: 1 })
              }
              className="w-full rounded-xl border border-[#22171C]/10 bg-[#FFF9FB] px-4 py-3 text-sm outline-none focus:border-[#22171C]/25"
            >
              <option value="all">All Categories</option>
              {STOREFRONT_CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.25em] text-[#6B7280]">
              Price Range
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                min={0}
                placeholder="Min ৳"
                value={filters.minPrice ?? ''}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    minPrice: e.target.value ? Number(e.target.value) : undefined,
                    page: 1,
                  })
                }
                className="rounded-xl border border-[#22171C]/10 bg-[#FFF9FB] px-4 py-3 text-sm outline-none focus:border-[#22171C]/25"
              />
              <input
                type="number"
                min={0}
                placeholder="Max ৳"
                value={filters.maxPrice ?? ''}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    maxPrice: e.target.value ? Number(e.target.value) : undefined,
                    page: 1,
                  })
                }
                className="rounded-xl border border-[#22171C]/10 bg-[#FFF9FB] px-4 py-3 text-sm outline-none focus:border-[#22171C]/25"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.25em] text-[#6B7280]">
              Sort By
            </label>
            <div className="space-y-2">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange({ ...filters, sort: opt.value, page: 1 })}
                  className={cn(
                    'flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition',
                    filters.sort === opt.value
                      ? 'border-[#22171C] bg-[#22171C] text-white'
                      : 'border-[#22171C]/10 bg-white hover:border-[#22171C]/20',
                  )}
                >
                  {opt.label}
                  {filters.sort === opt.value && <ArrowUpDown className="h-4 w-4 opacity-70" />}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={reset}
              className="flex-1 rounded-full border border-[#22171C]/15 py-3 text-sm font-medium transition hover:border-[#22171C]"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex-1 rounded-full bg-[#22171C] py-3 text-sm font-medium text-white transition hover:bg-[#FF3F7F]"
            >
              Apply
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}