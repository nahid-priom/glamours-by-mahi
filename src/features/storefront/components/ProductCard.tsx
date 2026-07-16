import { memo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Heart, ShoppingBag, Star } from 'lucide-react'
import { formatBDT } from '@/lib/format'
import { getProductCoverImage } from '@/lib/images/product-image-utils'
import { AppImage } from '@/components/common/AppImage'
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
  variant = 'default',
  className,
}: ProductCardProps) {
  const { addItem, toggleWishlist, isWishlisted } = useCart()
  const { openQuickView } = useStorefrontUI()
  const [hovered, setHovered] = useState(false)

  const wishlisted = isWishlisted(product.id)
  const stock = getDisplayStock(product)
  const outOfStock = stock <= 0
  const discount = getProductDiscount(product)
  const badges = buildBadges(product, discount)
  const needsOptions =
    Boolean(product.catalogSizes?.length || product.catalogColors?.length) ||
    product.category === 'accessories' ||
    product.isLimited
  const showRating = variant !== 'compact'
  const showButton = variant !== 'compact'
  const price = getCardPrice(product)

  const coverImage = getProductCoverImage(product)
  const imageSrc = hovered && product.hoverImage ? product.hoverImage : coverImage

  const handleCta = () => {
    if (outOfStock) return
    if (needsOptions) {
      openQuickView(product)
      return
    }
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
  }

  return (
    <article
      className={cn(
        'group flex h-[320px] flex-col overflow-hidden rounded-[22px] border border-[var(--sf-border)] bg-white shadow-sm transition-all duration-300',
        'md:h-[390px] lg:h-[390px] xl:h-[400px]',
        'hover:-translate-y-0.5 hover:border-[var(--sf-primary)]/40 hover:shadow-[0_16px_40px_-24px_rgba(255,63,127,0.35)]',
        className,
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="relative h-[155px] shrink-0 overflow-hidden bg-[#FFF9FB] md:h-[210px] lg:h-[230px]">
        <Link to={`/product/${product.slug}`} className="block h-full">
          <AppImage
            src={imageSrc}
            alt={getCardProductName(product)}
            className="h-full w-full"
            imgClassName={cn(
              'transition-transform duration-500',
              hovered && 'scale-105',
            )}
            objectFit="cover"
            aspectRatio="auto"
          />
        </Link>

        {badges.length > 0 && (
          <div className="absolute left-1.5 top-1.5 flex max-w-[calc(100%-2.75rem)] flex-wrap gap-1 sm:left-2 sm:top-2">
            {badges.map((badge) => (
              <span
                key={badge.label}
                className={cn(
                  'flex h-5 items-center rounded-full px-2 text-[9px] font-bold uppercase tracking-wide',
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
            'absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-md backdrop-blur transition hover:scale-105 sm:right-2 sm:top-2 sm:h-9 sm:w-9',
            wishlisted && 'text-[#FF3F7F]',
          )}
          aria-label="Wishlist"
        >
          <Heart className={cn('h-3.5 w-3.5 sm:h-4 sm:w-4', wishlisted && 'fill-current')} />
        </button>

        <div className="absolute right-1.5 top-11 hidden flex-col gap-1.5 opacity-0 transition duration-300 group-hover:opacity-100 sm:right-2 sm:top-12 md:flex">
          <button
            type="button"
            onClick={() => openQuickView(product)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-md backdrop-blur transition hover:scale-105"
            aria-label="Quick view"
          >
            <Eye className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-2.5 sm:p-3">
        <p className="truncate text-[10px] uppercase tracking-[0.18em] text-slate-400">
          {getCardCategory(product)}
        </p>

        <Link to={`/product/${product.slug}`} className="mt-0.5 block min-h-[20px] sm:min-h-[25px]">
          <h3 className="line-clamp-2 text-[13px] font-semibold leading-4 text-[#22171C] transition hover:text-[#FF3F7F] sm:text-sm sm:leading-5">
            {getCardProductName(product)}
          </h3>
        </Link>

        <div className="mt-1 flex h-5 items-center gap-x-1.5 overflow-hidden sm:mt-1.5 sm:h-6">
          {price > 0 ? (
            <>
              <span className="text-sm font-bold text-[#22171C] sm:text-base">{formatBDT(price)}</span>
              {product.onSale && product.salePrice && (
                <>
                  <span className="text-xs text-slate-400 line-through">{formatBDT(product.price)}</span>
                  <span className="text-[10px] font-semibold text-primary">{discount}% OFF</span>
                </>
              )}
            </>
          ) : (
            <span className="text-xs font-medium text-[#6B7280]">Price unavailable</span>
          )}
        </div>

        <div className="mt-0.5 mb-2.5 flex h-4 items-center sm:mt-1 sm:mb-3">
          {showRating && getCardReviewCount(product) > 0 && getCardRating(product) > 0 ? (
            <StarRating rating={getCardRating(product)} count={getCardReviewCount(product)} />
          ) : (
            <span className="invisible text-[11px]">—</span>
          )}
        </div>

        {showButton ? (
          <button
            type="button"
            onClick={handleCta}
            disabled={outOfStock}
            className={cn(
              'mt-auto flex h-8 w-full items-center justify-center gap-1 rounded-full border text-[10px] font-bold uppercase tracking-[0.12em] transition sm:h-9',
              outOfStock
                ? 'cursor-not-allowed border-[var(--sf-border)] bg-[var(--sf-bg)] text-[var(--sf-muted)]'
                : 'border-[var(--sf-border)] text-[var(--sf-ink)] hover:border-[var(--sf-primary)] hover:bg-[var(--sf-primary)] hover:text-white',
            )}
          >
            {!outOfStock && <ShoppingBag className="h-3 w-3 md:hidden" aria-hidden />}
            {outOfStock ? 'Out of Stock' : needsOptions ? 'Choose Options' : 'Add to Cart'}
          </button>
        ) : (
          <div className="mt-auto h-8 shrink-0 sm:h-9" aria-hidden />
        )}
      </div>
    </article>
  )
})
