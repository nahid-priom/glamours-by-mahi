import { useState, useEffect, useCallback, memo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { HERO_SLIDES } from '@/lib/product-images'
import { storefrontService } from '../storefront.service'
import { HeroSlider } from './HeroSlider'
import { HeroContent } from './HeroContent'
import { HeroCtaButtons } from './HeroCtaButtons'
import { HeroTrustBadges } from './HeroTrustBadges'
import { HeroSlideIndicators } from './HeroSlideIndicators'

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
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion || HERO_SLIDES.length <= 1) return
    const id = window.setInterval(() => {
      const next = (activeRef.current + 1) % HERO_SLIDES.length
      goToSlide(next)
    }, 9000)
    return () => window.clearInterval(id)
  }, [goToSlide])

  const slide = HERO_SLIDES[active]

  return (
    <section className="hero-luxury relative overflow-x-hidden">
      <div className="hero-grain pointer-events-none absolute inset-0" aria-hidden />

      <div className="relative mx-auto grid min-h-[calc(100vh-80px)] max-w-[1440px] min-w-0 items-center gap-6 px-4 py-4 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-12 lg:py-14 xl:px-20">
        <div className="order-1 min-w-0 lg:order-2">
          <HeroSlider slide={slide} visible={visible} previewProducts={previewProducts} />
        </div>

        <div className="order-2 flex min-w-0 flex-col justify-center lg:order-1">
          <HeroContent slide={slide} visible={visible} />
          <HeroCtaButtons visible={visible} className="mt-8" />
          <HeroTrustBadges />
          <HeroSlideIndicators
            count={HERO_SLIDES.length}
            active={active}
            onSelect={goToSlide}
          />
        </div>
      </div>
    </section>
  )
})
