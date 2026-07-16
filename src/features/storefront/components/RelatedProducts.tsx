import { useQuery } from '@tanstack/react-query'
import { ProductCard } from './ProductCard'
import { ProductGridSkeleton } from './ProductCardSkeleton'
import { storefrontService } from '../storefront.service'
import type { StorefrontProduct } from '../storefront.types'
import { useRecentlyViewed } from '../hooks/useRecentlyViewed'

interface RelatedProductsProps {
  product: StorefrontProduct
}

export function RelatedProducts({ product }: RelatedProductsProps) {
  const { ids } = useRecentlyViewed()

  const { data: related, isLoading: relatedLoading } = useQuery({
    queryKey: ['storefront', 'related', product.id],
    queryFn: () => storefrontService.getRelated(product, 4),
  })

  const { data: recentlyViewed, isLoading: recentLoading } = useQuery({
    queryKey: ['storefront', 'recently-viewed', product.id, ids],
    queryFn: () => storefrontService.getRecentlyViewedProducts(ids, product.id, 4),
    enabled: ids.length > 0,
  })

  return (
    <div className="space-y-16">
      {(relatedLoading || (related && related.length > 0)) && (
        <section>
          <h2 className="font-serif text-2xl text-[#22171C] sm:text-3xl">You May Also Like</h2>
          <div className="mt-6">
            {relatedLoading ? (
              <ProductGridSkeleton count={4} />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 md:gap-6">
                {related?.map((item) => (
                  <ProductCard key={item.id} product={item} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {(recentLoading || (recentlyViewed && recentlyViewed.length > 0)) && (
        <section>
          <h2 className="font-serif text-2xl text-[#22171C] sm:text-3xl">Recently Viewed</h2>
          <div className="mt-6">
            {recentLoading ? (
              <ProductGridSkeleton count={4} />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 md:gap-6">
                {recentlyViewed?.map((item) => (
                  <ProductCard key={item.id} product={item} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
