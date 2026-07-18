import { useEffect, useState } from 'react'
import { ArrowUpDown, Grid2X2, Grid3X3, Search, SlidersHorizontal, X } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { formatBDT } from '@/lib/format'
import type { StorefrontFilters } from '../storefront.types'
import { formatShowingRange } from '../lib/shop-utils'

export type GridViewMode = 'grid' | 'large'

interface CategoryFilterBarProps {
  filters: StorefrontFilters
  onChange: (filters: StorefrontFilters) => void
  onClearOptional: () => void
  total: number
  loaded: number
  page: number
  viewMode: GridViewMode
  onViewModeChange: (mode: GridViewMode) => void
}

const SORT_OPTIONS: { value: NonNullable<StorefrontFilters['sort']>; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Best Selling' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
]

/** Optional filters active on top of the route category (category is fixed by URL). */
function countOptionalFilters(filters: StorefrontFilters): number {
  let count = 0
  if (filters.brand?.trim()) count++
  if (filters.onSale) count++
  if (filters.minPrice != null && filters.minPrice > 0) count++
  if (filters.maxPrice != null) count++
  if (filters.search?.trim()) count++
  if (filters.sort && filters.sort !== 'newest') count++
  return count
}

export function CategoryFilterBar({
  filters,
  onChange,
  onClearOptional,
  total,
  loaded,
  page,
  viewMode,
  onViewModeChange,
}: CategoryFilterBarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchInput, setSearchInput] = useState(filters.search ?? '')
  const optionalCount = countOptionalFilters(filters)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  const chips = buildChips(filters)

  return (
    <>
      <div className="rounded-2xl border border-[var(--sf-border)] bg-white shadow-sm">
        {/* Desktop */}
        <div className="hidden min-h-[68px] items-end gap-3 px-4 py-3 lg:flex xl:px-5">
          <FilterSelect
            label="Sort"
            value={filters.sort ?? 'newest'}
            onChange={(v) => onChange({ ...filters, sort: v as StorefrontFilters['sort'], page: 1 })}
            options={SORT_OPTIONS}
          />

          <div>
            <span className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--sf-muted)]">
              Price
            </span>
            <div className="flex items-center gap-1.5">
              <PriceInput
                placeholder="Min"
                value={filters.minPrice}
                onCommit={(n) => onChange({ ...filters, minPrice: n, page: 1 })}
              />
              <span className="text-[var(--sf-muted)]">–</span>
              <PriceInput
                placeholder="Max"
                value={filters.maxPrice}
                onCommit={(n) => onChange({ ...filters, maxPrice: n, page: 1 })}
              />
            </div>
          </div>

          <div className="relative min-w-0 flex-1">
            <span className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--sf-muted)]">
              Search in category
            </span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--sf-primary)]" />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search this category…"
                aria-label="Search within this category"
                className="w-full rounded-xl border border-[var(--sf-border)] bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-[var(--sf-primary)]"
              />
            </div>
          </div>

          <label className="flex shrink-0 cursor-pointer items-center gap-2 pb-1 text-xs font-medium text-[var(--sf-ink)]">
            <input
              type="checkbox"
              checked={Boolean(filters.onSale)}
              onChange={(e) => onChange({ ...filters, onSale: e.target.checked, page: 1 })}
              className="h-4 w-4 accent-[var(--sf-primary)]"
            />
            On sale
          </label>

          {optionalCount > 0 ? (
            <button
              type="button"
              onClick={onClearOptional}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--sf-border)] px-3 py-2 text-xs font-medium text-[var(--sf-muted)] transition hover:border-[var(--sf-primary)] hover:text-[var(--sf-primary)]"
            >
              <X className="h-3.5 w-3.5" />
              Clear all
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--sf-primary)] px-1 text-[10px] font-bold text-white">
                {optionalCount}
              </span>
            </button>
          ) : null}
        </div>

        {/* Mobile */}
        <div className="flex min-h-[56px] items-center justify-between gap-2 px-3 py-2.5 lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="relative flex items-center gap-2 rounded-full border border-[var(--sf-border)] bg-white px-4 py-2 text-xs font-medium"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filter &amp; Sort
            {optionalCount > 0 ? (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--sf-primary)] px-1 text-[9px] font-bold text-white">
                {optionalCount}
              </span>
            ) : null}
          </button>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--sf-primary)]" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search…"
              aria-label="Search within this category"
              className="w-full rounded-full border border-[var(--sf-border)] bg-white py-2 pl-8 pr-3 text-xs outline-none"
            />
          </div>
        </div>
      </div>

      {/* Results row */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[var(--sf-muted)] sm:text-sm">
          {formatShowingRange(page, pageSize, total, loaded)}
        </p>
        <div className="flex items-center rounded-full border border-[var(--sf-border)] bg-white p-1">
          <button
            type="button"
            onClick={() => onViewModeChange('grid')}
            aria-label="Grid view"
            aria-pressed={viewMode === 'grid'}
            className={cn(
              'rounded-full p-2 transition',
              viewMode === 'grid'
                ? 'bg-[var(--sf-ink)] text-white'
                : 'text-[var(--sf-muted)] hover:text-[var(--sf-ink)]',
            )}
          >
            <Grid3X3 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('large')}
            aria-label="Large grid view"
            aria-pressed={viewMode === 'large'}
            className={cn(
              'rounded-full p-2 transition',
              viewMode === 'large'
                ? 'bg-[var(--sf-ink)] text-white'
                : 'text-[var(--sf-muted)] hover:text-[var(--sf-ink)]',
            )}
          >
            <Grid2X2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Active filter chips */}
      {chips.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => onChange({ ...filters, ...chip.clear, page: 1 })}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--sf-primary-soft)] px-3 py-1.5 text-xs font-medium text-[var(--sf-primary)]"
            >
              {chip.label}
              <X className="h-3 w-3" aria-hidden />
              <span className="sr-only">Remove {chip.label}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={onClearOptional}
            className="text-xs font-medium text-[var(--sf-muted)] underline-offset-2 hover:underline"
          >
            Clear all
          </button>
        </div>
      ) : null}

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto rounded-t-[28px] px-0 pb-8">
          <SheetHeader className="border-b border-[var(--sf-border)] px-6 pb-4">
            <SheetTitle className="font-serif text-xl">Filter &amp; Sort</SheetTitle>
            <SheetDescription>Refine this category</SheetDescription>
          </SheetHeader>

          <div className="space-y-6 px-6 pt-6">
            <div>
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--sf-muted)]">
                Price Range
              </label>
              <div className="grid grid-cols-2 gap-3">
                <PriceInput
                  placeholder="Min ৳"
                  value={filters.minPrice}
                  onCommit={(n) => onChange({ ...filters, minPrice: n, page: 1 })}
                  fullWidth
                />
                <PriceInput
                  placeholder="Max ৳"
                  value={filters.maxPrice}
                  onCommit={(n) => onChange({ ...filters, maxPrice: n, page: 1 })}
                  fullWidth
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-[var(--sf-border)] px-4 py-3 text-sm">
              On sale only
              <input
                type="checkbox"
                checked={Boolean(filters.onSale)}
                onChange={(e) => onChange({ ...filters, onSale: e.target.checked, page: 1 })}
                className="h-4 w-4 accent-[var(--sf-primary)]"
              />
            </label>

            <div>
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--sf-muted)]">
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
                        ? 'border-[var(--sf-ink)] bg-[var(--sf-ink)] text-white'
                        : 'border-[var(--sf-border)] bg-white hover:border-[var(--sf-primary)]',
                    )}
                  >
                    {opt.label}
                    {filters.sort === opt.value ? <ArrowUpDown className="h-4 w-4 opacity-70" /> : null}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClearOptional}
                className="flex-1 rounded-full border border-[var(--sf-border)] py-3 text-sm font-medium transition hover:border-[var(--sf-ink)]"
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="flex-1 rounded-full bg-[var(--sf-ink)] py-3 text-sm font-medium text-white transition hover:bg-[var(--sf-primary)]"
              >
                Show {total} items
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

type Chip = { key: string; label: string; clear: Partial<StorefrontFilters> }

function buildChips(filters: StorefrontFilters): Chip[] {
  const chips: Chip[] = []
  if (filters.search?.trim()) {
    chips.push({ key: 'search', label: `“${filters.search.trim()}”`, clear: { search: undefined } })
  }
  if (filters.minPrice != null && filters.minPrice > 0) {
    chips.push({ key: 'min', label: `Min ${formatBDT(filters.minPrice)}`, clear: { minPrice: undefined } })
  }
  if (filters.maxPrice != null) {
    chips.push({ key: 'max', label: `Max ${formatBDT(filters.maxPrice)}`, clear: { maxPrice: undefined } })
  }
  if (filters.brand?.trim()) {
    chips.push({ key: 'brand', label: filters.brand.trim(), clear: { brand: undefined } })
  }
  if (filters.onSale) {
    chips.push({ key: 'sale', label: 'On sale', clear: { onSale: false } })
  }
  if (filters.sort && filters.sort !== 'newest') {
    const label = SORT_OPTIONS.find((o) => o.value === filters.sort)?.label ?? 'Sorted'
    chips.push({ key: 'sort', label, clear: { sort: 'newest' } })
  }
  return chips
}

function FilterSelect({
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
      <span className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--sf-muted)]">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-[var(--sf-border)] bg-white px-3 py-2 text-xs font-medium outline-none focus:border-[var(--sf-primary)]"
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

function PriceInput({
  placeholder,
  value,
  onCommit,
  fullWidth,
}: {
  placeholder: string
  value: number | undefined
  onCommit: (value: number | undefined) => void
  fullWidth?: boolean
}) {
  const [local, setLocal] = useState(value != null ? String(value) : '')

  useEffect(() => {
    setLocal(value != null ? String(value) : '')
  }, [value])

  const commit = () => {
    const trimmed = local.trim()
    if (!trimmed) {
      onCommit(undefined)
      return
    }
    const n = Number(trimmed)
    onCommit(Number.isFinite(n) && n >= 0 ? n : undefined)
  }

  return (
    <input
      type="number"
      min={0}
      inputMode="numeric"
      placeholder={placeholder}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
      }}
      className={cn(
        'rounded-lg border border-[var(--sf-border)] bg-white px-2.5 py-2 text-xs outline-none focus:border-[var(--sf-primary)]',
        fullWidth ? 'w-full' : 'w-20',
      )}
    />
  )
}
