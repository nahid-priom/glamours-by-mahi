import { RotateCcw, ShoppingBag } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StorefrontProduct, ProductCardVariant } from '../storefront.types'
import { ProductCard } from './ProductCard'
import { ProductGridSkeleton } from './ProductCardSkeleton'

export type GridViewMode = 'grid' | 'large'

interface ProductGridProps {
  products: StorefrontProduct[]
  loading?: boolean
  viewMode?: GridViewMode
  cardVariant?: ProductCardVariant
  onClearFilters?: () => void
  emptyMessage?: string
}

const gridClasses: Record<GridViewMode, string> = {
  grid: 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
  large: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
}

export function ProductGrid({
  products,
  loading,
  viewMode = 'grid',
  cardVariant,
  onClearFilters,
  emptyMessage,
}: ProductGridProps) {
  if (loading) {
    return (
      <ProductGridSkeleton
        count={viewMode === 'large' ? 6 : 10}
        variant={viewMode === 'large' ? 'large' : 'default'}
      />
    )
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[32px] border border-dashed border-[#22171C]/10 bg-white/60 px-6 py-16 text-center sm:py-24">
        <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-[#FFF9FB]">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#FF3F7F]/10 to-transparent" />
          <ShoppingBag className="relative h-10 w-10 text-[#22171C]/30" strokeWidth={1.25} />
        </div>
        <h3 className="font-serif text-2xl text-[#22171C]">No products found</h3>
        <p className="mt-2 max-w-sm text-sm text-[#6B7280]">
          {emptyMessage ??
            "We couldn't find anything matching your filters. Try adjusting your search or browse our full collection."}
        </p>
        {onClearFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#22171C] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#FF3F7F]"
          >
            <RotateCcw className="h-4 w-4" />
            Clear filters
          </button>
        )}
      </div>
    )
  }

  const resolvedVariant = cardVariant ?? (viewMode === 'large' ? 'large' : 'default')

  return (
    <div className={cn('grid items-stretch gap-3', gridClasses[viewMode])}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} variant={resolvedVariant} className="h-full" />
      ))}
    </div>
  )
}
