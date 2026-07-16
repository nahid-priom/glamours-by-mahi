import { useEffect, useRef, useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { storefrontService } from './storefront.service'
import { CollectionHero } from './components/CollectionHero'
import { ProductToolbar, type GridViewMode } from './components/ProductToolbar'
import { ProductGrid } from './components/ProductGrid'
import { RecommendedProducts } from './components/RecommendedProducts'
import { DEFAULT_SHOP_FILTERS } from './lib/shop-utils'
import {
  buildShopSearchParams,
  parseShopFiltersFromSearchParams,
} from './lib/shop-filter-url'
import type { StorefrontFilters, StorefrontProduct } from './storefront.types'

export function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [page, setPage] = useState(1)
  const [viewMode, setViewMode] = useState<GridViewMode>('grid')
  const [filters, setFilters] = useState<StorefrontFilters>(() => ({
    ...DEFAULT_SHOP_FILTERS,
    ...parseShopFiltersFromSearchParams(searchParams),
  }))
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setFilters({
      ...DEFAULT_SHOP_FILTERS,
      ...parseShopFiltersFromSearchParams(searchParams),
    })
    setPage(1)
  }, [searchParams])

  const queryFilters = useMemo(() => ({ ...filters, page }), [filters, page])

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['storefront', 'shop', queryFilters],
    queryFn: () => storefrontService.getShopProducts(queryFilters),
  })

  const [allProducts, setAllProducts] = useState<StorefrontProduct[]>([])

  useEffect(() => {
    if (!data) return
    if (page === 1) {
      setAllProducts(data.products)
    } else {
      setAllProducts((prev) => {
        const ids = new Set(prev.map((p) => p.id))
        return [...prev, ...data.products.filter((p) => !ids.has(p.id))]
      })
    }
  }, [data, page])

  useEffect(() => {
    setPage(1)
  }, [
    filters.category,
    filters.sort,
    filters.style,
    filters.brand,
    filters.onSale,
    filters.minPrice,
    filters.maxPrice,
    filters.search,
  ])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !data?.hasMore) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetching) {
          setPage((p) => p + 1)
        }
      },
      { rootMargin: '200px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [data?.hasMore, isFetching])

  const total = data?.total ?? 0
  const pageSize = filters.pageSize ?? 24

  const handleFilterChange = (next: StorefrontFilters) => {
    setFilters(next)
    setPage(1)
    setSearchParams(buildShopSearchParams(next), { replace: true })
  }

  return (
    <div className="min-w-0 overflow-x-hidden">
      <CollectionHero
        total={total}
        loaded={allProducts.length}
        page={page}
        pageSize={pageSize}
      />

      <div className="mx-auto max-w-[1440px] px-3 sm:px-6 xl:px-8">
        <ProductToolbar
          filters={filters}
          onChange={handleFilterChange}
          total={total}
          loaded={allProducts.length}
          page={page}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        <ProductGrid
          products={allProducts}
          loading={isLoading && page === 1}
          viewMode={viewMode}
          onClearFilters={() => handleFilterChange(DEFAULT_SHOP_FILTERS)}
        />

        {isFetching && page > 1 && (
          <p className="mt-8 text-center text-sm text-[#6B7280]">Loading more pieces…</p>
        )}

        <div ref={sentinelRef} className="h-4" />

        <RecommendedProducts />
      </div>
    </div>
  )
}
