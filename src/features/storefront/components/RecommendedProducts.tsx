import { useQuery } from '@tanstack/react-query'
import { ProductCarousel } from './ProductCarousel'
import { storefrontService } from '../storefront.service'
import { useRecentlyViewed } from '../hooks/useRecentlyViewed'

export function RecommendedProducts() {
  const { ids, resolveProducts } = useRecentlyViewed()

  const { data: catalog = [] } = useQuery({
    queryKey: ['storefront', 'catalog-all'],
    queryFn: async () => {
      const result = await storefrontService.getShopProducts({ page: 1, pageSize: 200 })
      return result.products
    },
    staleTime: 120_000,
  })

  const recentlyViewed = resolveProducts(catalog, 8)

  const { data: recentlyAdded = [] } = useQuery({
    queryKey: ['storefront', 'recently-added'],
    queryFn: () => storefrontService.getRecentlyAdded(8),
    staleTime: 60_000,
  })

  const { data: recommended = [] } = useQuery({
    queryKey: ['storefront', 'recommended'],
    queryFn: async () => {
      const featured = await storefrontService.getFeatured(4)
      const trending = await storefrontService.getTrending(4)
      const seen = new Set<string>()
      return [...featured, ...trending].filter((p) => {
        if (seen.has(p.id)) return false
        seen.add(p.id)
        return true
      })
    },
    staleTime: 60_000,
  })

  return (
    <div className="mt-16 space-y-14 border-t border-[#111111]/5 pt-14 sm:mt-20 sm:pt-16">
      {recentlyViewed.length > 0 && (
        <ProductCarousel
          subtitle="Your History"
          title="Recently Viewed"
          products={recentlyViewed}
        />
      )}

      {recentlyAdded.length > 0 && (
        <ProductCarousel
          subtitle="Just Dropped"
          title="Recently Added"
          products={recentlyAdded}
        />
      )}

      {recommended.length > 0 && (
        <ProductCarousel
          subtitle="Curated For You"
          title="Recommended For You"
          products={recommended}
        />
      )}

      {ids.length === 0 && recentlyAdded.length === 0 && recommended.length === 0 && null}
    </div>
  )
}
