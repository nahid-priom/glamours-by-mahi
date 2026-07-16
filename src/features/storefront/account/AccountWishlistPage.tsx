import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Heart, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCart } from '../cart.context'
import { storefrontService } from '../storefront.service'
import { ProductCard } from '../components/ProductCard'
import { Skeleton } from '@/components/ui/skeleton'

export function AccountWishlistPage() {
  const { wishlistIds, toggleWishlist, addItem } = useCart()

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['account', 'wishlist', [...wishlistIds]],
    queryFn: async () => {
      const result = await storefrontService.getShopProducts({ pageSize: 200 })
      return result.products.filter((p) => wishlistIds.has(p.id))
    },
    enabled: wishlistIds.size > 0,
  })

  if (wishlistIds.size === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-[#22171C]/15 bg-white py-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#FF3F7F]/10">
          <Heart className="h-7 w-7 text-[#FF3F7F]" />
        </div>
        <h2 className="mt-4 font-serif text-2xl text-[#22171C]">Your wishlist is empty</h2>
        <p className="mt-2 text-sm text-[#6B7280]">Save pieces you love and shop them anytime.</p>
        <Link to="/shop">
          <Button className="mt-6 rounded-full">Explore Collection</Button>
        </Link>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[4/5] rounded-[28px]" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-[#22171C]/8 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-serif text-2xl text-[#22171C]">Wishlist</h2>
        <p className="mt-1 text-sm text-[#6B7280]">{products.length} saved items</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => (
          <div key={product.id} className="relative">
            <ProductCard product={product} />
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                className="flex-1 rounded-full"
                onClick={() => addItem(product, 1)}
              >
                <ShoppingBag className="mr-1.5 h-3.5 w-3.5" />
                Add to Cart
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => toggleWishlist(product.id, product.slug)}
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
