import { PackageSearch, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ProductCatalogFilters } from '../lib/product-filters'
import { countActiveFilters } from '../lib/product-list-model'

type Props = {
  filters: ProductCatalogFilters
  onClearFilters?: () => void
  onRetry?: () => void
  variant?: 'empty' | 'filtered' | 'category' | 'error'
}

export function ProductEmptyState({ filters, onClearFilters, onRetry, variant = 'empty' }: Props) {
  const activeFilters = countActiveFilters(filters)

  if (variant === 'error') {
    return (
      <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-10 text-center">
        <p className="text-sm font-medium text-[#B91C1C]">Failed to load products.</p>
        <p className="mt-1 text-sm text-[#DC2626]">Check your connection and try again.</p>
        {onRetry ? (
          <Button size="sm" variant="outline" className="mt-4" onClick={onRetry}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Retry
          </Button>
        ) : null}
      </div>
    )
  }

  const title =
    variant === 'category'
      ? 'No products in this category'
      : activeFilters > 0
        ? 'No products match your filters'
        : 'No products found'

  const description =
    variant === 'category'
      ? 'Try another category or clear the category filter to see more products.'
      : activeFilters > 0
        ? 'Adjust your search or filters to find products in your catalog.'
        : 'Add your first product to start building your catalog.'

  return (
    <div className="rounded-xl border border-dashed border-border bg-white px-4 py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-[#6B7280]">
        <PackageSearch className="h-5 w-5" />
      </div>
      <p className="mt-4 text-sm font-semibold text-[#111111]">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-[#6B7280]">{description}</p>
      {activeFilters > 0 && onClearFilters ? (
        <Button size="sm" variant="outline" className="mt-4" onClick={onClearFilters}>
          Clear filters
        </Button>
      ) : null}
    </div>
  )
}
