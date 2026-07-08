import { STOREFRONT_CATEGORIES } from '@/lib/constants'
import type { StorefrontFilters } from '../storefront.types'

interface ProductFiltersProps {
  filters: StorefrontFilters
  onChange: (filters: StorefrontFilters) => void
}

export function ProductFilters({ filters, onChange }: ProductFiltersProps) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-stone-200 bg-white p-4 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex-1 min-w-[140px]">
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-500">Category</label>
        <select
          value={filters.category ?? 'all'}
          onChange={(e) => onChange({ ...filters, category: e.target.value as StorefrontFilters['category'], page: 1 })}
          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-primary"
        >
          <option value="all">All Categories</option>
          {STOREFRONT_CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>{c.label}</option>
          ))}
        </select>
      </div>
      <div className="flex-1 min-w-[140px]">
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-500">Sort</label>
        <select
          value={filters.sort ?? 'newest'}
          onChange={(e) => onChange({ ...filters, sort: e.target.value as StorefrontFilters['sort'], page: 1 })}
          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-primary"
        >
          <option value="newest">Newest</option>
          <option value="popular">Popular</option>
          <option value="price-asc">Price: Low to High</option>
          <option value="price-desc">Price: High to Low</option>
        </select>
      </div>
      <div className="w-full sm:w-28">
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-500">Min ৳</label>
        <input
          type="number"
          min={0}
          value={filters.minPrice ?? ''}
          onChange={(e) => onChange({ ...filters, minPrice: e.target.value ? Number(e.target.value) : undefined, page: 1 })}
          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-primary"
          placeholder="0"
        />
      </div>
      <div className="w-full sm:w-28">
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-500">Max ৳</label>
        <input
          type="number"
          min={0}
          value={filters.maxPrice ?? ''}
          onChange={(e) => onChange({ ...filters, maxPrice: e.target.value ? Number(e.target.value) : undefined, page: 1 })}
          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-primary"
          placeholder="10000"
        />
      </div>
    </div>
  )
}
