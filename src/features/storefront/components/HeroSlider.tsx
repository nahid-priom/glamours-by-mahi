import { memo } from 'react'
import { Link } from 'react-router-dom'
import { formatBDT } from '@/lib/format'
import type { HeroSlide } from '@/lib/product-images'
import type { StorefrontProduct } from '../storefront.types'
import { cn } from '@/lib/utils'
import { HeroFloatingCard } from './HeroFloatingCard'
import { LazyImage } from './LazyImage'

interface HeroSliderProps {
  slide: HeroSlide
  visible: boolean
  previewProducts: StorefrontProduct[]
}

export const HeroSlider = memo(function HeroSlider({
  slide,
  visible,
  previewProducts,
}: HeroSliderProps) {
  return (
    <div className="relative mx-auto w-full min-w-0 max-w-[650px]">
      {/* Image + floating cards — clip on mobile so cards don't cause page overflow */}
      <div className="relative overflow-hidden sm:overflow-visible">
        <div
          className={cn(
            'hero-image-enter relative aspect-square overflow-hidden rounded-[40px] shadow-[0_32px_80px_-24px_rgba(15,23,42,0.35)]',
            visible ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
        >
          <LazyImage
            src={slide.image}
            alt={slide.alt}
            aspectRatio="square"
            className="aspect-square h-full w-full rounded-[40px]"
            imgClassName="rounded-[40px] object-cover"
          />
          <div className="pointer-events-none absolute inset-0 rounded-[40px] bg-gradient-to-t from-black/20 via-transparent to-transparent" />
        </div>

        {/* Floating glass cards — desktop/tablet only */}
        <HeroFloatingCard
          title="New Collection"
          subtitle="500+ Styles"
          className="absolute left-2 top-[12%] z-10 hidden max-w-[130px] sm:-left-6 sm:block sm:max-w-none lg:-left-10"
          delay={0}
        />
        <HeroFloatingCard
          title="4.9 ★ Rating"
          subtitle="10k+ Customers"
          className="absolute right-2 top-[38%] z-10 hidden max-w-[130px] sm:-right-4 sm:block sm:max-w-none lg:-right-8"
          delay={1.5}
        />
        <HeroFloatingCard
          title="Cash On Delivery"
          subtitle="All Bangladesh"
          className="absolute bottom-[18%] left-2 z-10 hidden max-w-[140px] sm:-left-4 sm:block lg:-left-6"
          delay={3}
        />
        <div
          className={cn(
            'hero-float absolute bottom-[8%] right-2 z-10 hidden rounded-full border border-white/40 bg-white/80 px-4 py-2 text-xs font-medium text-slate-800 shadow-xl backdrop-blur-md sm:right-auto sm:block sm:-right-1',
          )}
          style={{ animationDelay: '2s' }}
        >
          {slide.accentLabel}
        </div>
      </div>

      {/* Product preview — desktop/tablet only */}
      {previewProducts.length > 0 && (
        <div className="mt-5 hidden min-w-0 sm:mt-6 sm:block">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">
            Trending Now
          </p>
          <div className="grid grid-cols-3 gap-3">
            {previewProducts.slice(0, 3).map((p) => (
              <Link
                key={p.id}
                to={`/product/${p.slug}`}
                className="flex items-center gap-2.5 rounded-2xl border border-white/60 bg-white/80 p-2.5 shadow-sm backdrop-blur-sm transition hover:shadow-md"
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl">
                  <LazyImage
                    src={p.image}
                    alt={p.alt}
                    aspectRatio="square"
                    className="h-12 w-12"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-xs font-medium leading-snug text-slate-900">
                    {p.name || 'Fashion Item'}
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-primary">
                    {formatBDT(p.displayPrice ?? p.price ?? 0)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
})
