import { Heart, Loader2, Minus, Plus, ShoppingBag, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatBDT } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { StorefrontProduct } from '../storefront.types'
import {
  getDiscountPercent,
  getDisplayCategory,
  getDisplayDescription,
  getDisplayName,
  getDisplayPrice,
  getDisplayRating,
  getDisplayReviewCount,
  getDisplayStock,
  getOriginalPrice,
  getStockStatus,
} from '../utils/product-display'
import type { ProductColor, ProductSize, ProductVariantOptions } from '../utils/product-variants'
import { ProductVariantSelector } from './ProductVariantSelector'
import { ProductTrustCards } from './ProductTrustCards'
import { ProductDetailsAccordion } from './ProductDetailsAccordion'

interface ProductInfoPanelProps {
  product: StorefrontProduct
  qty: number
  onQtyChange: (qty: number) => void
  selectedSize?: ProductSize
  selectedColor?: ProductColor
  onSizeChange: (size: ProductSize) => void
  onColorChange: (color: ProductColor) => void
  variantOptions: ProductVariantOptions | null
  canPurchase: boolean
  wishlisted: boolean
  onToggleWishlist: () => void
  onAddToCart: () => void
  onBuyNow: () => void
  isAdding?: boolean
  isBuying?: boolean
}

export function ProductInfoPanel({
  product,
  qty,
  onQtyChange,
  selectedSize,
  selectedColor,
  onSizeChange,
  onColorChange,
  variantOptions,
  canPurchase,
  wishlisted,
  onToggleWishlist,
  onAddToCart,
  onBuyNow,
  isAdding = false,
  isBuying = false,
}: ProductInfoPanelProps) {
  const stock = getDisplayStock(product)
  const stockStatus = getStockStatus(product)
  const discount = getDiscountPercent(product)
  const outOfStock = stock <= 0

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
          {getDisplayCategory(product)}
        </p>
        <h1 className="mt-3 font-serif text-3xl leading-tight text-[#111111] lg:text-5xl">
          {getDisplayName(product)}
        </h1>

        <div className="mt-4 flex items-center gap-2 text-sm text-[#6B7280]">
          <div className="flex items-center gap-0.5" aria-hidden>
            {Array.from({ length: 5 }).map((_, index) => (
              <Star
                key={index}
                className={cn(
                  'h-3.5 w-3.5',
                  index < Math.floor(getDisplayRating(product))
                    ? 'fill-amber-400 text-amber-400'
                    : 'fill-[#E5E7EB] text-[#E5E7EB]',
                )}
              />
            ))}
          </div>
          <span className="font-medium text-[#111111]">{getDisplayRating(product).toFixed(1)}</span>
          <span>({getDisplayReviewCount(product)} reviews)</span>
        </div>

        <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-3xl font-bold text-[#111111]">{formatBDT(getDisplayPrice(product))}</span>
          {product.onSale && product.salePrice && (
            <>
              <span className="text-base text-[#6B7280] line-through">
                {formatBDT(getOriginalPrice(product))}
              </span>
              <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-600">
                {discount}% OFF
              </span>
            </>
          )}
        </div>

        <p
          className={cn(
            'mt-3 text-sm font-medium',
            stockStatus === 'in_stock' && 'text-green-600',
            stockStatus === 'low_stock' && 'text-amber-600',
            stockStatus === 'out_of_stock' && 'text-[#E11D48]',
          )}
        >
          {stockStatus === 'in_stock' && `In stock — ${stock} available`}
          {stockStatus === 'low_stock' && `Low stock — only ${stock} left`}
          {stockStatus === 'out_of_stock' && 'Out of stock'}
        </p>
      </div>

      <p className="text-sm leading-relaxed text-[#6B7280]">{getDisplayDescription(product)}</p>

      {variantOptions && (
        <ProductVariantSelector
          sizes={variantOptions.sizes}
          colors={variantOptions.colors}
          disabledSizes={variantOptions.disabledSizes}
          selectedSize={selectedSize}
          selectedColor={selectedColor}
          onSizeChange={onSizeChange}
          onColorChange={onColorChange}
        />
      )}

      {!outOfStock && (
        <div className="flex items-center gap-4">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6B7280]">Quantity</span>
          <div className="flex items-center rounded-full border border-[#111111]/10 bg-white">
            <button
              type="button"
              onClick={() => onQtyChange(Math.max(1, qty - 1))}
              className="px-4 py-3 text-[#111111] transition hover:bg-[#F8F6F2]"
              aria-label="Decrease quantity"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-10 text-center text-sm font-semibold">{qty}</span>
            <button
              type="button"
              onClick={() => onQtyChange(Math.min(stock, qty + 1))}
              disabled={qty >= stock}
              className="px-4 py-3 text-[#111111] transition hover:bg-[#F8F6F2] disabled:opacity-40"
              aria-label="Increase quantity"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="hidden lg:block">
        <div className="flex gap-3">
          <Button
            className="h-14 flex-[0.6] rounded-full bg-[#111111] text-sm font-semibold hover:bg-[#E11D48]"
            disabled={!canPurchase || isAdding}
            onClick={onAddToCart}
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
          <Button
            variant="outline"
            className="h-14 flex-[0.4] rounded-full border-[#111111]/15 text-sm font-semibold hover:bg-[#111111] hover:text-white"
            disabled={!canPurchase || isBuying}
            onClick={onBuyNow}
          >
            {isBuying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buy Now'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(
              'h-14 w-14 shrink-0 rounded-full border-[#111111]/15',
              wishlisted && 'border-[#E11D48] text-[#E11D48]',
            )}
            onClick={onToggleWishlist}
            aria-label="Toggle wishlist"
          >
            <Heart className={cn('h-5 w-5', wishlisted && 'fill-current')} />
          </Button>
        </div>
      </div>

      <ProductTrustCards />
      <ProductDetailsAccordion product={product} />
    </div>
  )
}
