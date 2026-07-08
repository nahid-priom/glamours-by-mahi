import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { storefrontService } from './storefront.service'
import { ProductGrid } from './components/ProductGrid'

export function SearchPage() {
  const [searchParams] = useSearchParams()
  const q = searchParams.get('q') ?? ''

  const { data: products, isLoading } = useQuery({
    queryKey: ['storefront', 'search', q],
    queryFn: () => storefrontService.search(q),
    enabled: q.length > 0,
  })

  const title = useMemo(() => (q ? `Results for "${q}"` : 'Search'), [q])

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="font-serif text-3xl text-stone-900">{title}</h1>
      {!q && <p className="mt-2 text-sm text-stone-500">Enter a search term from the header</p>}
      {q && (
        <p className="mt-1 text-sm text-stone-500">
          {products ? `${products.length} product${products.length !== 1 ? 's' : ''} found` : ''}
        </p>
      )}
      <div className="mt-6">
        <ProductGrid
          products={products ?? []}
          loading={isLoading && q.length > 0}
          emptyMessage={q ? 'No products match your search.' : 'Start typing to search products.'}
        />
      </div>
    </div>
  )
}
