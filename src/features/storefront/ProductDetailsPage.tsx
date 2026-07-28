import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Loader2, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { formatBDT } from '@/lib/format'
import { Skeleton } from '@/components/ui/skeleton'
import { storefrontService } from './storefront.service'
import { trackRecentlyViewed } from './hooks/useRecentlyViewed'
import { useCart } from './cart.context'
import { useStorefrontUI } from './storefront-ui.context'
import { useVariantSelection } from './hooks/useVariantSelection'
import { ProductGallery } from './components/ProductGallery'
import { ProductInfoPanel } from './components/ProductInfoPanel'
import { RelatedProducts } from './components/RelatedProducts'
import { getDisplayName, getDisplayPrice, getDisplayStock } from './utils/product-display'
import { getAutoSelectableVariant } from './utils/product-variants'
import type { StorefrontProduct } from './storefront.types'

function ProductDetailsContent({ product }: { product: StorefrontProduct }) {
  const navigate = useNavigate()
  const { addItem, toggleWishlist, isWishlisted } = useCart()
  const { openCart } = useStorefrontUI()
  const { toast } = useToast()

  const [qty, setQty] = useState(1)
  const [isAdding, setIsAdding] = useState(false)
  const [isBuying, setIsBuying] = useState(false)

  const selection = useVariantSelection(product)
  const { attributes, selectedVariant, missingAttributes } = selection

  const hasAttributes = attributes.length > 0
  const resolved = hasAttributes ? selectedVariant : getAutoSelectableVariant(product)
  const stock = resolved ? resolved.stock : getDisplayStock(product)
  const outOfStock = stock <= 0
  const canPurchase = hasAttributes
    ? resolved !== null && resolved.stock > 0
    : !outOfStock && (Boolean(resolved) || !product.catalogVariants?.length)

  const selectionHint =
    hasAttributes && missingAttributes.length > 0
      ? `Please select ${missingAttributes.join(' and ')}.`
      : hasAttributes && !resolved
        ? 'This combination is currently out of stock.'
        : null

  useEffect(() => {
    trackRecentlyViewed(product.id)
  }, [product.id])

  const addResolvedToCart = (): boolean => {
    // Products backed by catalog variants must carry a real variant id.
    if (product.catalogVariants?.length && !resolved?.id) {
      toast('Please select the available options.', 'error')
      return false
    }
    addItem(
      product,
      qty,
      resolved
        ? {
            variantId: resolved.id,
            price: resolved.sellingPrice,
            sku: resolved.sku,
            maxStock: resolved.stock,
            name: getDisplayName(product),
          }
        : undefined,
    )
    return true
  }

  const handleAddToCart = () => {
    if (!canPurchase) return
    setIsAdding(true)
    try {
      if (addResolvedToCart()) {
        toast(`${getDisplayName(product)} added to cart`)
        openCart()
      }
    } finally {
      setIsAdding(false)
    }
  }

  const handleBuyNow = () => {
    if (!canPurchase) return
    setIsBuying(true)
    try {
      if (addResolvedToCart()) navigate('/checkout')
    } finally {
      setIsBuying(false)
    }
  }

  return (
    <div className="min-w-0 overflow-x-hidden bg-[#FFF9FB] pb-28 lg:pb-20">
      <div className="mx-auto max-w-[1440px] px-4 pt-6 sm:px-6 lg:pt-10 xl:px-10">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <ProductGallery product={product} activeVariantImage={resolved?.image} />

          <div className="lg:sticky lg:top-28 lg:self-start">
            <ProductInfoPanel
              product={product}
              qty={qty}
              onQtyChange={setQty}
              selection={selection}
              canPurchase={canPurchase}
              selectionHint={selectionHint}
              wishlisted={isWishlisted(product.id)}
              onToggleWishlist={() => toggleWishlist(product.id, product.slug)}
              onAddToCart={handleAddToCart}
              onBuyNow={handleBuyNow}
              isAdding={isAdding}
              isBuying={isBuying}
            />
          </div>
        </div>

        <div className="mt-16 border-t border-[#22171C]/8 pt-16 lg:mt-20 lg:pt-20">
          <RelatedProducts product={product} />
        </div>
      </div>

      {/* Mobile sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#22171C]/8 bg-white/95 p-4 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-[1440px] items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[#22171C]">{getDisplayName(product)}</p>
            <p className="text-lg font-bold text-[#22171C]">
              {formatBDT(resolved?.sellingPrice ?? getDisplayPrice(product))}
            </p>
          </div>
          <Button
            className="h-12 shrink-0 rounded-full bg-[#22171C] px-5 text-xs font-semibold hover:bg-[#FF3F7F]"
            disabled={!canPurchase || isAdding}
            onClick={handleAddToCart}
          >
            {isAdding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <ShoppingBag className="h-4 w-4" />
                Add to Cart
              </>
            )}
          </Button>
        </div>
        <Button
          variant="outline"
          className="mt-2 h-11 w-full rounded-full border-[#22171C]/15 text-xs font-semibold"
          disabled={!canPurchase || isBuying}
          onClick={handleBuyNow}
        >
          {isBuying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buy Now'}
        </Button>
      </div>
    </div>
  )
}

export function ProductDetailsPage() {
  const { slug } = useParams<{ slug: string }>()

  const { data: product, isLoading } = useQuery({
    queryKey: ['storefront', 'product', slug],
    queryFn: () => storefrontService.getProductBySlug(slug!),
    enabled: !!slug,
  })

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 xl:px-10">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <Skeleton className="aspect-[4/5] rounded-[32px]" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-14 w-full rounded-full" />
          </div>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-[1440px] flex-col items-center justify-center px-4 py-20 text-center sm:px-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-[#6B7280]">Unavailable</p>
        <h1 className="mt-3 font-serif text-3xl text-[#22171C] sm:text-4xl">Product not available</h1>
        <p className="mt-3 max-w-md text-sm text-[#6B7280]">
          This piece may have sold out or been removed from our collection.
        </p>
        <Button asChild className="mt-8 h-12 rounded-full px-8">
          <Link to="/shop">Continue Shopping</Link>
        </Button>
      </div>
    )
  }

  return <ProductDetailsContent key={product.id} product={product} />
}
