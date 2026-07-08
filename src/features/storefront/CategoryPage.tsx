import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { STOREFRONT_CATEGORIES } from '@/lib/constants'
import { storefrontService } from './storefront.service'
import { ProductGrid } from './components/ProductGrid'
import type { StorefrontCategorySlug } from '@/lib/constants'

export function CategoryPage() {
  const { slug } = useParams<{ slug: string }>()
  const [pageSize, setPageSize] = useState(24)

  const category = STOREFRONT_CATEGORIES.find((c) => c.slug === slug)
  const categorySlug = (slug ?? 'new-arrival') as StorefrontCategorySlug

  const filters = useMemo(
    () => ({ category: categorySlug, page: 1, pageSize }),
    [categorySlug, pageSize],
  )

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['storefront', 'category', filters],
    queryFn: () => storefrontService.getShopProducts(filters),
  })

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:py-14">
      <p className="text-[11px] uppercase tracking-[0.3em] text-[#6B7280]">Category</p>
      <h1 className="mt-2 font-serif text-4xl text-[#111111]">{category?.label ?? slug}</h1>
      <p className="mt-2 text-sm text-[#6B7280]">{data ? `${data.total} pieces` : ''}</p>
      <div className="mt-10">
        <ProductGrid products={data?.products ?? []} loading={isLoading} emptyMessage="No products in this category yet." />
      </div>
      {data && data.products.length < data.total && (
        <div className="mt-10 text-center">
          <button
            type="button"
            disabled={isFetching}
            onClick={() => setPageSize((s) => s + 24)}
            className="rounded-full border border-[#111111]/15 px-8 py-3 text-sm font-medium transition hover:border-[#111111]"
          >
            {isFetching ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  )
}
