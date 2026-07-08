import { useEffect, useState } from 'react'
import { ArrowUpDown, Grid2X2, Grid3X3, Search, SlidersHorizontal, X } from 'lucide-react'
import { STOREFRONT_CATEGORIES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { StorefrontFilters } from '../storefront.types'
import { countActiveFilters, DEFAULT_SHOP_FILTERS, formatShowingRange } from '../lib/shop-utils'
import { FilterDrawer } from './FilterDrawer'

export type GridViewMode = 'grid' | 'large'

interface ProductToolbarProps {
  filters: StorefrontFilters
  onChange: (filters: StorefrontFilters) => void
  total: number
  loaded: number
  page: number
  viewMode: GridViewMode
  onViewModeChange: (mode: GridViewMode) => void
}

const SORT_OPTIONS: { value: NonNullable<StorefrontFilters['sort']>; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Popular' },
  { value: 'price-asc', label: 'Price ↑' },
  { value: 'price-desc', label: 'Price ↓' },
]

export function ProductToolbar({
  filters,
  onChange,
  total,
  loaded,
  page,
  viewMode,
  onViewModeChange,
}: ProductToolbarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerFocus, setDrawerFocus] = useState<'filter' | 'sort'>('filter')
  const [searchInput, setSearchInput] = useState(filters.search ?? '')
  const activeCount = countActiveFilters(filters)
  const pageSize = filters.pageSize ?? 24

  useEffect(() => {
    setSearchInput(filters.search ?? '')
  }, [filters.search])

  useEffect(() => {
    const id = window.setTimeout(() => {
      const trimmed = searchInput.trim()
      if (trimmed !== (filters.search ?? '')) {
        onChange({ ...filters, search: trimmed || undefined, page: 1 })
      }
    }, 350)
    return () => window.clearTimeout(id)
  }, [searchInput]) // eslint-disable-line react-hooks/exhaustive-deps

  const clearFilters = () => onChange({ ...DEFAULT_SHOP_FILTERS })

  const openDrawer = (focus: 'filter' | 'sort') => {
    setDrawerFocus(focus)
    setDrawerOpen(true)
  }

  return (
    <>
      <div className="sticky top-[72px] z-40 -mx-4 mb-6 px-4 sm:-mx-6 sm:px-6 lg:top-[76px]">
        <div className="rounded-2xl border border-[#111111]/8 bg-white shadow-sm">
          {/* Desktop toolbar */}
          <div className="hidden min-h-[72px] items-center gap-3 px-4 py-3 lg:flex xl:px-5">
            <ToolbarSelect
              label="Category"
              value={filters.category ?? 'all'}
              onChange={(v) => onChange({ ...filters, category: v as StorefrontFilters['category'], page: 1 })}
              options={[
                { value: 'all', label: 'All' },
                ...STOREFRONT_CATEGORIES.map((c) => ({ value: c.slug, label: c.label })),
              ]}
            />

            <ToolbarSelect
              label="Sort"
              value={filters.sort ?? 'newest'}
              onChange={(v) => onChange({ ...filters, sort: v as StorefrontFilters['sort'], page: 1 })}
              options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />

            <div className="flex items-end gap-2">
              <div>
                <span className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.2em] text-[#6B7280]">
                  Price
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    placeholder="Min"
                    value={filters.minPrice ?? ''}
                    onChange={(e) =>
                      onChange({
                        ...filters,
                        minPrice: e.target.value ? Number(e.target.value) : undefined,
                        page: 1,
                      })
                    }
                    className="w-20 rounded-lg border border-[#111111]/10 px-2.5 py-2 text-xs outline-none focus:border-[#111111]/25"
                  />
                  <span className="text-[#6B7280]">–</span>
                  <input
                    type="number"
                    min={0}
                    placeholder="Max"
                    value={filters.maxPrice ?? ''}
                    onChange={(e) =>
                      onChange({
                        ...filters,
                        maxPrice: e.target.value ? Number(e.target.value) : undefined,
                        page: 1,
                      })
                    }
                    className="w-20 rounded-lg border border-[#111111]/10 px-2.5 py-2 text-xs outline-none focus:border-[#111111]/25"
                  />
                </div>
              </div>
            </div>

            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
              <input
                type="search"
                placeholder="Search products..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full rounded-xl border border-[#111111]/10 bg-[#F8F6F2]/60 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-[#111111]/20 focus:bg-white"
              />
            </div>

            {activeCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#111111]/10 px-3 py-2 text-xs font-medium text-[#6B7280] transition hover:border-[#E11D48]/30 hover:text-[#E11D48]"
              >
                <X className="h-3.5 w-3.5" />
                Clear
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E11D48] px-1 text-[10px] font-bold text-white">
                  {activeCount}
                </span>
              </button>
            )}
          </div>

          {/* Mobile toolbar */}
          <div className="flex min-h-[56px] items-center justify-between gap-2 px-3 py-2.5 lg:hidden">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => openDrawer('filter')}
                className="relative flex items-center gap-2 rounded-full border border-[#111111]/10 bg-[#F8F6F2] px-4 py-2 text-xs font-medium"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filter
                {activeCount > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#E11D48] px-1 text-[9px] font-bold text-white">
                    {activeCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => openDrawer('sort')}
                className="flex items-center gap-2 rounded-full border border-[#111111]/10 bg-[#F8F6F2] px-4 py-2 text-xs font-medium"
              >
                <ArrowUpDown className="h-4 w-4" />
                Sort
              </button>
            </div>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6B7280]" />
              <input
                type="search"
                placeholder="Search..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full rounded-full border border-[#111111]/10 bg-[#F8F6F2]/60 py-2 pl-8 pr-3 text-xs outline-none"
              />
            </div>
          </div>
        </div>

        {/* Results row */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[#6B7280] sm:text-sm">
            {formatShowingRange(page, pageSize, total, loaded)}
          </p>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 sm:flex">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6B7280]">Sort</span>
              <select
                value={filters.sort ?? 'newest'}
                onChange={(e) => onChange({ ...filters, sort: e.target.value as StorefrontFilters['sort'], page: 1 })}
                className="rounded-lg border border-[#111111]/10 bg-white px-3 py-1.5 text-xs font-medium outline-none"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center rounded-full border border-[#111111]/10 bg-white p-1">
              <button
                type="button"
                onClick={() => onViewModeChange('grid')}
                aria-label="Grid view"
                className={cn(
                  'rounded-full p-2 transition',
                  viewMode === 'grid' ? 'bg-[#111111] text-white' : 'text-[#6B7280] hover:text-[#111111]',
                )}
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange('large')}
                aria-label="Large grid view"
                className={cn(
                  'rounded-full p-2 transition',
                  viewMode === 'large' ? 'bg-[#111111] text-white' : 'text-[#6B7280] hover:text-[#111111]',
                )}
              >
                <Grid2X2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <FilterDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        filters={filters}
        onChange={onChange}
        focus={drawerFocus}
      />
    </>
  )
}

function ToolbarSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="shrink-0">
      <span className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.2em] text-[#6B7280]">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-[#111111]/10 bg-white px-3 py-2 text-xs font-medium outline-none focus:border-[#111111]/25"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
