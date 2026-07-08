import { useState, useEffect, useCallback, memo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { HERO_SLIDES } from '@/lib/product-images'
import { cn } from '@/lib/utils'
import { storefrontService } from '../storefront.service'
import { HeroSlider } from './HeroSlider'
import { HeroTrustBadges } from './HeroTrustBadges'

export const HeroBanner = memo(function HeroBanner() {
  const [active, setActive] = useState(0)
  const [visible, setVisible] = useState(true)
  const activeRef = useRef(active)
  activeRef.current = active

  const { data: previewProducts = [] } = useQuery({
    queryKey: ['storefront', 'hero-preview'],
    queryFn: () => storefrontService.getNewArrivals(3),
    staleTime: 120_000,
  })

  const goToSlide = useCallback((index: number) => {
    setVisible(false)
    window.setTimeout(() => {
      setActive(index)
      setVisible(true)
    }, 350)
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => {
      const next = (activeRef.current + 1) % HERO_SLIDES.length
      goToSlide(next)
    }, 6000)
    return () => window.clearInterval(id)
  }, [goToSlide])

  const slide = HERO_SLIDES[active]

  return (
    <section className="hero-luxury relative overflow-x-hidden">
      <div className="hero-grain pointer-events-none absolute inset-0" aria-hidden />

      <div className="relative mx-auto grid min-h-[calc(100vh-80px)] max-w-[1440px] min-w-0 items-center gap-6 px-4 py-4 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-12 lg:py-14 xl:px-20">
        {/* Mobile: image first */}
        <div className="order-1 min-w-0 lg:order-2">
          <HeroSlider slide={slide} visible={visible} previewProducts={previewProducts} />
        </div>

        {/* Content */}
        <div className="order-2 flex min-w-0 flex-col justify-center lg:order-1">
          <div
            className={cn(
              'transition-all duration-500 ease-out',
              visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
            )}
          >
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-rose-500">
                {slide.badgeTop}
              </p>
              <p className="text-[10px] font-medium uppercase tracking-[0.35em] text-slate-400">
                {slide.badgeBottom}
              </p>
            </div>

            <h1 className="mt-6 font-serif text-5xl font-normal leading-[0.95] sm:text-6xl lg:text-7xl xl:text-8xl">
              <span className="block bg-gradient-to-b from-slate-950 to-slate-700 bg-clip-text text-transparent">
                {slide.headline[0]}
              </span>
              <span className="mt-1 block bg-gradient-to-b from-slate-950 to-slate-700 bg-clip-text text-transparent">
                {slide.headline[1]}
              </span>
            </h1>

            <p className="mt-6 max-w-[500px] text-base leading-relaxed text-slate-600 sm:text-lg">
              {slide.subtitle}
            </p>
          </div>

          <div
            className={cn(
              'mt-8 flex flex-col gap-3 transition-all duration-500 delay-75 sm:flex-row sm:flex-wrap',
              visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
            )}
          >
            <Link
              to="/shop"
              className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-black px-8 text-sm font-medium text-white shadow-xl transition hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-slate-900 sm:w-auto"
            >
              Shop Now <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to={slide.ctaSecondaryTo}
              className="inline-flex h-14 w-full items-center justify-center rounded-full border border-slate-300 bg-transparent px-8 text-sm font-medium text-slate-900 transition hover:border-slate-900 hover:bg-white/50 sm:w-auto"
            >
              {slide.ctaSecondary}
            </Link>
          </div>

          <HeroTrustBadges />

          {/* Slide indicators — pill style */}
          <div className="mt-10 flex items-center gap-2">
            {HERO_SLIDES.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === active ? 'true' : undefined}
                onClick={() => goToSlide(i)}
                className={cn(
                  'h-2.5 rounded-full transition-all duration-300',
                  i === active ? 'w-10 bg-black' : 'w-3 bg-slate-300 hover:bg-slate-400',
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
})
