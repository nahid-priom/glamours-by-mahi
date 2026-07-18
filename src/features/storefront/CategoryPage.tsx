import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ChevronRight, SearchX } from 'lucide-react'
import { storefrontService } from './storefront.service'
import { ProductGrid } from './components/ProductGrid'
import { ProductGridSkeleton } from './components/ProductCardSkeleton'
import { CategoryFilterBar, type GridViewMode } from './components/CategoryFilterBar'
import { resolveCategoryBySlug } from './repositories/menu-categories.repository'
import { parseShopFiltersFromSearchParams, buildShopSearchParams } from './lib/shop-filter-url'
import type { StorefrontFilters, StorefrontProduct } from './storefront.types'

export function CategoryPage() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [page, setPage] = useState(1)
  const [viewMode, setViewMode] = useState<GridViewMode>('grid')
  const [allProducts, setAllProducts] = useState<StorefrontProduct[]>([])
  const sentinelRef = useRef<HTMLDivElement>(null)

  const {
    data: resolved,
    isLoading: resolving,
    isError: resolveError,
  } = useQuery({
    queryKey: ['storefront', 'category-resolve', slug],
    queryFn: () => resolveCategoryBySlug(slug ?? ''),
    enabled: Boolean(slug),
  })

  // Optional filters (sort/price/brand/search) live in the URL; the category is
  // fixed by the route slug, so we ignore any `category` param here.
  const urlFilters = useMemo(
    () => parseShopFiltersFromSearchParams(searchParams),
    [searchParams],
  )

  useEffect(() => {
    setPage(1)
  }, [slug, searchParams])

  const queryFilters = useMemo<StorefrontFilters>(
    () => ({
      ...urlFilters,
      category: 'all',
      categorySlugs: resolved?.filterSlugs,
      page,
    }),
    [urlFilters, resolved, page],
  )

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ['storefront', 'category-products', resolved?.id, queryFilters],
    queryFn: () => storefrontService.getShopProducts(queryFilters),
    enabled: Boolean(resolved),
    placeholderData: keepPreviousData,
  })

  useEffect(() => {
    if (!data) return
    if (page === 1) {
      setAllProducts(data.products)
    } else {
      setAllProducts((prev) => {
        const seen = new Set(prev.map((p) => p.id))
        return [...prev, ...data.products.filter((p) => !seen.has(p.id))]
      })
    }
  }, [data, page])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !data?.hasMore) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetching) setPage((p) => p + 1)
      },
      { rootMargin: '240px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [data?.hasMore, isFetching])

  const handleFilterChange = (next: StorefrontFilters) => {
    setPage(1)
    setSearchParams(buildShopSearchParams({ ...next, category: 'all' }), { replace: true })
  }

  const clearOptional = () => {
    setPage(1)
    setSearchParams(new URLSearchParams(), { replace: true })
  }

  const total = data?.total ?? 0
  const hasOptionalFilters = searchParams.toString().length > 0

  if (resolving) {
    return (
      <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:py-14">
        <div className="h-3 w-24 animate-pulse rounded bg-[var(--sf-border)]" />
        <div className="mt-3 h-9 w-64 animate-pulse rounded bg-[var(--sf-border)]" />
        <div className="mt-10">
          <ProductGridSkeleton count={10} />
        </div>
      </div>
    )
  }

  if (resolveError) {
    return (
      <CategoryMessage
        icon={<AlertTriangle className="h-9 w-9 text-[var(--sf-primary)]" strokeWidth={1.4} />}
        title="Something went wrong"
        body="We couldn't load this category right now. Please check your connection and try again."
        actionLabel="Browse all products"
        actionTo="/shop"
      />
    )
  }

  if (!resolved) {
    return (
      <CategoryMessage
        icon={<SearchX className="h-9 w-9 text-[var(--sf-primary)]" strokeWidth={1.4} />}
        title="Category not found"
        body={`We couldn't find a category for “${slug}”. It may have been renamed or is no longer available.`}
        actionLabel="Browse all products"
        actionTo="/shop"
      />
    )
  }

  return (
    <div className="mx-auto min-w-0 max-w-[1440px] overflow-x-hidden px-4 py-8 sm:px-6 lg:py-12">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[var(--sf-muted)]">
        <Link to="/" className="hover:text-[var(--sf-primary)]">
          Home
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        <Link to="/shop" className="hover:text-[var(--sf-primary)]">
          Shop
        </Link>
        {resolved.parentName ? (
          <>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            <span>{resolved.parentName}</span>
          </>
        ) : null}
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        <span className="text-[var(--sf-ink)]">{resolved.name}</span>
      </nav>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--sf-muted)]">
            {resolved.kind === 'subcategory' ? 'Collection' : 'Category'}
          </p>
          <h1 className="mt-1.5 font-serif text-3xl text-[var(--sf-ink)] sm:text-4xl">{resolved.name}</h1>
        </div>
        <p className="text-sm text-[var(--sf-muted)]">
          {isLoading ? 'Loading…' : `${total} ${total === 1 ? 'piece' : 'pieces'}`}
        </p>
      </div>

      {resolved.description ? (
        <p className="mt-2 max-w-2xl text-sm text-[var(--sf-muted)]">{resolved.description}</p>
      ) : null}

      <div className="mt-8">
        <CategoryFilterBar
          filters={queryFilters}
          onChange={handleFilterChange}
          onClearOptional={clearOptional}
          total={total}
          loaded={allProducts.length}
          page={page}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      </div>

      <div className="mt-8">
        {isError ? (
          <CategoryInlineError />
        ) : (
          <ProductGrid
            products={allProducts}
            loading={isLoading && page === 1}
            viewMode={viewMode}
            onClearFilters={hasOptionalFilters ? clearOptional : undefined}
            emptyMessage={
              hasOptionalFilters
                ? 'No products match these filters. Try clearing them to see the full category.'
                : `No products in ${resolved.name} yet. Check back soon.`
            }
          />
        )}

        {isFetching && page > 1 ? (
          <p className="mt-8 text-center text-sm text-[var(--sf-muted)]">Loading more pieces…</p>
        ) : null}

        <div ref={sentinelRef} className="h-4" />
      </div>
    </div>
  )
}

function CategoryInlineError() {
  return (
    <div className="flex flex-col items-center justify-center rounded-[32px] border border-dashed border-[var(--sf-border)] bg-white/60 px-6 py-16 text-center">
      <AlertTriangle className="h-10 w-10 text-[var(--sf-primary)]" strokeWidth={1.3} />
      <h3 className="mt-4 font-serif text-2xl text-[var(--sf-ink)]">Couldn’t load products</h3>
      <p className="mt-2 max-w-sm text-sm text-[var(--sf-muted)]">
        There was a problem loading products for this category. Please try again in a moment.
      </p>
    </div>
  )
}

function CategoryMessage({
  icon,
  title,
  body,
  actionLabel,
  actionTo,
}: {
  icon: ReactNode
  title: string
  body: string
  actionLabel: string
  actionTo: string
}) {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:py-24">
      <div className="mx-auto flex max-w-md flex-col items-center rounded-[32px] border border-dashed border-[var(--sf-border)] bg-white/60 px-6 py-16 text-center">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-[var(--sf-primary-soft)]">{icon}</div>
        <h1 className="mt-6 font-serif text-3xl text-[var(--sf-ink)]">{title}</h1>
        <p className="mt-2 text-sm text-[var(--sf-muted)]">{body}</p>
        <Link
          to={actionTo}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--sf-ink)] px-6 py-3 text-sm font-medium text-white transition hover:bg-[var(--sf-primary)]"
        >
          {actionLabel}
        </Link>
      </div>
    </div>
  )
}
