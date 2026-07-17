import { memo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Eye, Heart, ShoppingBag, Star } from 'lucide-react'
import { formatBDT } from '@/lib/format'
import { ProductImage } from '@/components/common/ProductImage'
import { cn } from '@/lib/utils'
import type { StorefrontProduct, ProductCardVariant } from '../storefront.types'
import { useCart } from '../cart.context'
import { useStorefrontUI } from '../storefront-ui.context'
import { getDisplayStock } from '../utils/product-display'
import { resolveCatalogVariant } from '../utils/product-variants'
import {
  buildBadges,
  getCardCategory,
  getCardPrice,
  getCardProductName,
  getCardRating,
  getCardReviewCount,
  getProductDiscount,
} from './product-card.utils'

interface ProductCardProps {
  product: StorefrontProduct
  variant?: ProductCardVariant
  className?: string
}

function StarRating({ rating, count }: { rating: number; count: number }) {
  const full = Math.floor(rating)
  const hasHalf = rating - full >= 0.5

  return (
    <div className="flex h-4 items-center gap-1 text-[11px] text-[#6B7280]">
      <div className="flex items-center gap-px" aria-hidden>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn(
              'h-2.5 w-2.5',
              i < full
                ? 'fill-amber-400 text-amber-400'
                : i === full && hasHalf
                  ? 'fill-amber-200 text-amber-400'
                  : 'fill-[#E5E7EB] text-[#E5E7EB]',
            )}
          />
        ))}
      </div>
      <span className="font-medium text-[#22171C]">{rating.toFixed(1)}</span>
      <span>({count})</span>
    </div>
  )
}

export const ProductCard = memo(function ProductCard({
  product,
  className,
}: ProductCardProps) {
  const { addItem, toggleWishlist, isWishlisted } = useCart()
  const { openQuickView } = useStorefrontUI()
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)
  const feedbackTimer = useRef<number | null>(null)

  const wishlisted = isWishlisted(product.id)
  const stock = getDisplayStock(product)
  const outOfStock = stock <= 0
  const discount = getProductDiscount(product)
  const badges = buildBadges(product, discount)
  const needsOptions =
    Boolean(product.catalogSizes?.length || product.catalogColors?.length) ||
    product.category === 'accessories' ||
    product.isLimited
  const price = getCardPrice(product)

  const handleCta = () => {
    if (outOfStock || adding) return
    if (needsOptions) {
      openQuickView(product)
      return
    }
    setAdding(true)
    const matched = resolveCatalogVariant(product)
    addItem(
      product,
      1,
      matched
        ? {
            variantId: matched.id,
            price: matched.sellingPrice,
            sku: matched.sku,
            maxStock: matched.stock,
          }
        : undefined,
    )
    setAdding(false)
    setAdded(true)
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current)
    feedbackTimer.current = window.setTimeout(() => setAdded(false), 900)
  }

  return (
    <article
      className={cn(
        'group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-pink-100 bg-white shadow-sm transition-all duration-300',
        'hover:-translate-y-1 hover:border-pink-200 hover:shadow-lg',
        className,
      )}
    >
      <div className="relative aspect-square shrink-0 overflow-hidden bg-pink-50">
        <button
          type="button"
          className="block h-full w-full text-left"
          onClick={() => openQuickView(product)}
          aria-label={`Quick view ${getCardProductName(product)}`}
        >
          <ProductImage
            product={product}
            alt={getCardProductName(product)}
            className="h-full w-full"
            imgClassName="object-cover object-center transition-transform duration-500 group-hover:scale-105"
            objectFit="cover"
            sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
          />
        </button>

        {badges.length > 0 && (
          <div className="absolute left-1.5 top-1.5 flex max-w-[calc(100%-2.75rem)] flex-wrap gap-1 sm:left-2 sm:top-2">
            {badges.map((badge) => (
              <span
                key={badge.label}
                className={cn(
                  'flex h-5 items-center rounded-full px-2 text-[9px] font-bold uppercase tracking-wide shadow-sm',
                  badge.className,
                )}
              >
                {badge.label}
              </span>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => toggleWishlist(product.id, product.slug)}
          className={cn(
            'absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow-md backdrop-blur transition hover:scale-105 sm:right-2 sm:top-2 sm:h-8 sm:w-8',
            wishlisted && 'text-[#FF3F7F]',
          )}
          aria-label="Wishlist"
        >
          <Heart className={cn('h-3.5 w-3.5 sm:h-4 sm:w-4', wishlisted && 'fill-current')} />
        </button>

        <div className="absolute bottom-2 right-2 opacity-100 transition duration-300 md:translate-y-2 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100">
          <button
            type="button"
            onClick={() => openQuickView(product)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-md backdrop-blur transition hover:scale-105"
            aria-label="Quick view"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-2 sm:p-2.5">
        <p className="truncate text-[9px] uppercase tracking-[0.14em] text-slate-400">
          {getCardCategory(product)}
        </p>

        <Link to={`/product/${product.slug}`} className="mt-0.5 block">
          <h3 className="line-clamp-2 text-xs font-semibold leading-4 text-[#22171C] transition hover:text-[#FF3F7F] sm:text-[13px]">
            {getCardProductName(product)}
          </h3>
        </Link>

        <div className="mt-auto pt-1.5">
          {getCardReviewCount(product) > 0 && getCardRating(product) > 0 ? (
            <StarRating rating={getCardRating(product)} count={getCardReviewCount(product)} />
          ) : null}
        </div>

        <div className="mt-0.5 flex min-h-5 flex-wrap items-baseline gap-x-1.5 overflow-hidden">
          {price > 0 ? (
            <>
              <span className="text-sm font-bold text-[#FF3F7F] sm:text-base">{formatBDT(price)}</span>
              {discount > 0 && product.salePrice ? (
                <>
                  <span className="text-[11px] text-slate-400 line-through">{formatBDT(product.price)}</span>
                </>
              ) : null}
              {product.unit ? <span className="text-[10px] text-text-muted">/ {product.unit}</span> : null}
            </>
          ) : (
            <span className="text-xs font-medium text-[#6B7280]">Price unavailable</span>
          )}
        </div>

        <div className="mb-1.5 mt-0.5 h-3.5 text-[9px] font-medium">
          <span className={outOfStock ? 'text-danger' : stock <= 5 ? 'text-warning' : 'text-success'}>
            {outOfStock ? 'Out of stock' : stock <= 5 ? `Only ${stock} left` : 'In stock'}
          </span>
        </div>

        <button
          type="button"
          onClick={handleCta}
          disabled={outOfStock || adding}
          className={cn(
            'flex h-8 w-full items-center justify-center gap-1.5 rounded-lg text-[11px] font-semibold text-white transition sm:h-9 sm:text-xs',
            outOfStock
              ? 'cursor-not-allowed bg-slate-200 text-slate-500'
              : added
                ? 'bg-success'
                : 'bg-[#ff3f7f] hover:bg-[#d91e5b]',
          )}
        >
          {added ? <Check className="h-3.5 w-3.5" /> : <ShoppingBag className="h-3.5 w-3.5" />}
          {outOfStock ? 'Out of Stock' : added ? 'Added' : adding ? 'Adding…' : needsOptions ? 'Choose Options' : 'Add to Cart'}
        </button>
      </div>
    </article>
  )
})
