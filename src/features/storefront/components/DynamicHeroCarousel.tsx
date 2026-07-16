import { useCallback, useEffect, useRef, useState, memo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { brandConfig } from '@/config/brand'
import { storefrontService } from '../storefront.service'
import { useActiveHeroSlides } from '@/features/website-settings/hooks/useHeroSlides'
import { resolveCtaHref } from '@/features/website-settings/services/hero-link-builder.service'
import type { PublicHeroSlide } from '@/features/website-settings/types/hero.types'
import { formatBDT } from '@/lib/format'

const FALLBACK_SLIDE: PublicHeroSlide = {
  id: 'fallback',
  eyebrow: 'Beauty · Fashion · Lifestyle',
  heading: 'Everyday',
  highlight_text: 'Glamour',
  description: brandConfig.tagline,
  offer_title: null,
  offer_subtitle: null,
  discount_text: null,
  coupon_code: null,
  primary_cta_label: 'Shop Now',
  primary_cta_type: 'all_products',
  primary_cta_config: {},
  primary_cta_url: '/shop',
  primary_cta_new_tab: false,
  secondary_cta_enabled: true,
  secondary_cta_label: 'Explore New Arrivals',
  secondary_cta_type: 'new_arrivals',
  secondary_cta_config: {},
  secondary_cta_url: '/shop?sort=newest&category=new-arrival',
  secondary_cta_new_tab: false,
  desktop_image_path: '',
  mobile_image_path: null,
  desktop_image_url: null,
  mobile_image_url: null,
  image_alt: brandConfig.name,
  image_focal_x: 50,
  image_focal_y: 50,
  image_object_position: 'center',
  overlay_opacity: 0,
  layout_direction: 'content_left',
  text_alignment: 'left',
  theme_variant: 'soft_pink',
  show_trust_points: true,
  show_floating_badges: false,
  show_trending_products: true,
  trust_points: ['Authentic products', 'Cash on delivery', 'Nationwide shipping'],
  floating_badges: [],
  sort_order: 0,
  created_at: new Date().toISOString(),
}

function objectPosition(slide: PublicHeroSlide): string {
  if (
    slide.image_object_position === 'custom' &&
    slide.image_focal_x != null &&
    slide.image_focal_y != null
  ) {
    return `${slide.image_focal_x}% ${slide.image_focal_y}%`
  }
  return slide.image_object_position || 'center'
}

const HeroSlidePanel = memo(function HeroSlidePanel({
  slide,
  isPrimaryHeading,
  showTrending,
}: {
  slide: PublicHeroSlide
  isPrimaryHeading: boolean
  showTrending: boolean
}) {
  const { data: trending = [] } = useQuery({
    queryKey: ['storefront', 'hero-preview'],
    queryFn: () => storefrontService.getNewArrivals(3),
    staleTime: 120_000,
    enabled: showTrending && slide.show_trending_products,
  })

  const primaryHref = resolveCtaHref(
    slide.primary_cta_type,
    slide.primary_cta_config,
    slide.primary_cta_url,
  )
  const secondaryHref = resolveCtaHref(
    slide.secondary_cta_type,
    slide.secondary_cta_config,
    slide.secondary_cta_url,
  )
  const contentLeft = slide.layout_direction !== 'content_right'
  const HeadingTag = isPrimaryHeading ? 'h1' : 'h2'
  const desktopSrc = slide.desktop_image_url
  const mobileSrc = slide.mobile_image_url || slide.desktop_image_url

  return (
    <div
      className={cn(
        'sf-container grid max-w-[1440px] min-h-[min(680px,calc(100vh-120px))] items-center gap-6 py-6 lg:min-h-[580px] lg:grid-cols-[0.45fr_0.55fr] lg:gap-10 lg:py-10',
        !contentLeft && 'lg:[direction:rtl] lg:[&>*]:[direction:ltr]',
      )}
    >
      <div
        className={cn(
          'order-2 flex flex-col justify-center lg:order-1',
          slide.text_alignment === 'center' && 'text-center items-center',
          slide.text_alignment === 'right' && 'text-right items-end',
        )}
      >
        {slide.eyebrow ? (
          <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-[var(--sf-primary)]">
            {slide.eyebrow}
          </p>
        ) : null}

        <HeadingTag className="mt-4 font-serif text-[2rem] leading-[1.05] text-[var(--sf-ink)] sm:text-5xl lg:text-[3.25rem]">
          <span className="block">{slide.heading}</span>
          {slide.highlight_text ? (
            <span className="mt-1 block text-[var(--sf-primary)]">{slide.highlight_text}</span>
          ) : null}
        </HeadingTag>

        {slide.description ? (
          <p className="mt-4 max-w-[460px] text-sm leading-relaxed text-[var(--sf-muted)] sm:text-base">
            {slide.description}
          </p>
        ) : null}

        {(slide.offer_title || slide.discount_text || slide.coupon_code) && (
          <div className="mt-5 rounded-2xl border border-[var(--sf-border)] bg-white/80 px-4 py-3">
            {slide.offer_title ? (
              <p className="text-sm font-semibold text-[var(--sf-ink)]">{slide.offer_title}</p>
            ) : null}
            {slide.offer_subtitle ? (
              <p className="text-xs text-[var(--sf-muted)]">{slide.offer_subtitle}</p>
            ) : null}
            <p className="mt-1 text-sm font-semibold text-[var(--sf-primary)]">
              {[slide.discount_text, slide.coupon_code ? `Use code: ${slide.coupon_code}` : null]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        )}

        <div className="mt-6 flex w-full max-w-md flex-col gap-3 sm:flex-row">
          <Link
            to={primaryHref}
            target={slide.primary_cta_new_tab ? '_blank' : undefined}
            rel={slide.primary_cta_new_tab ? 'noreferrer' : undefined}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--sf-primary)] px-6 text-sm font-semibold text-white shadow-[0_12px_30px_-12px_rgba(255,63,127,0.65)] transition hover:bg-[var(--sf-primary-hover)]"
          >
            {slide.primary_cta_label || 'Shop Now'}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          {slide.secondary_cta_enabled && slide.secondary_cta_label ? (
            <Link
              to={secondaryHref}
              target={slide.secondary_cta_new_tab ? '_blank' : undefined}
              rel={slide.secondary_cta_new_tab ? 'noreferrer' : undefined}
              className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-[var(--sf-border)] bg-white/80 px-6 text-sm font-semibold text-[var(--sf-ink)] transition hover:border-[var(--sf-primary)] hover:bg-[var(--sf-primary-soft)]"
            >
              {slide.secondary_cta_label}
            </Link>
          ) : null}
        </div>

        {slide.show_trust_points && slide.trust_points.length > 0 ? (
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
            {slide.trust_points.slice(0, 3).map((point) => (
              <li key={point} className="flex items-center gap-1.5 text-xs text-[var(--sf-muted)] sm:text-sm">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--sf-primary-soft)] text-[var(--sf-primary)]">
                  <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                </span>
                {point}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="relative order-1 min-h-[260px] overflow-hidden rounded-3xl bg-[var(--sf-primary-soft)] lg:order-2 lg:min-h-[520px]">
        {desktopSrc || mobileSrc ? (
          <picture>
            {mobileSrc ? <source media="(max-width: 767px)" srcSet={mobileSrc} /> : null}
            <img
              src={desktopSrc || mobileSrc || undefined}
              alt={slide.image_alt || slide.heading}
              className="h-full w-full object-cover"
              style={{ objectPosition: objectPosition(slide) }}
              fetchPriority={isPrimaryHeading ? 'high' : 'auto'}
              loading={isPrimaryHeading ? 'eager' : 'lazy'}
            />
          </picture>
        ) : (
          <div className="flex h-full min-h-[260px] items-center justify-center bg-gradient-to-br from-[var(--sf-primary-soft)] via-white to-[var(--sf-primary-light)] lg:min-h-[520px]">
            <p className="font-serif text-2xl text-[var(--sf-primary)]">{brandConfig.shortName}</p>
          </div>
        )}

        {slide.overlay_opacity > 0 ? (
          <div
            className="pointer-events-none absolute inset-0 bg-[var(--sf-ink)]"
            style={{ opacity: slide.overlay_opacity }}
            aria-hidden
          />
        ) : null}

        {slide.show_floating_badges &&
          slide.floating_badges.slice(0, 2).map((badge, i) => (
            <span
              key={`${badge.label}-${i}`}
              className={cn(
                'absolute rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide shadow-md',
                i === 0 ? 'left-4 top-4' : 'bottom-4 right-4',
                badge.tone === 'ink' && 'bg-[var(--sf-ink)] text-white',
                badge.tone === 'soft' && 'bg-white text-[var(--sf-primary)]',
                (!badge.tone || badge.tone === 'primary') && 'bg-[var(--sf-primary)] text-white',
              )}
            >
              {badge.label}
            </span>
          ))}

        {showTrending && slide.show_trending_products && trending.length > 0 ? (
          <div className="absolute bottom-4 left-4 right-4 hidden gap-2 lg:flex">
            {trending.map((p) => (
              <Link
                key={p.id}
                to={`/product/${p.slug}`}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-white/95 p-2 shadow-md backdrop-blur"
              >
                <img src={p.image} alt="" className="h-12 w-10 rounded-lg object-cover" />
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold text-[var(--sf-ink)]">{p.name}</p>
                  <p className="text-[11px] text-[var(--sf-primary)]">{formatBDT(p.displayPrice)}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
})

export function DynamicHeroCarousel() {
  const { data, isLoading, isError } = useActiveHeroSlides()
  const slides = data && data.length > 0 ? data : [FALLBACK_SLIDE]
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const activeRef = useRef(0)
  activeRef.current = active

  useEffect(() => {
    if (isError) {
      console.warn('[hero] No active slides from Supabase; using fallback hero.')
    }
  }, [isError])

  useEffect(() => {
    setActive(0)
  }, [slides.length])

  const goTo = useCallback((index: number) => {
    setActive(((index % slides.length) + slides.length) % slides.length)
    setPaused(true)
  }, [slides.length])

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion || slides.length <= 1 || paused) return

    const onVisibility = () => {
      if (document.hidden) setPaused(true)
    }
    document.addEventListener('visibilitychange', onVisibility)

    const id = window.setInterval(() => {
      if (document.hidden) return
      setActive((prev) => (prev + 1) % slides.length)
    }, 7500)

    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [slides.length, paused])

  if (isLoading) {
    return (
      <section className="hero-luxury border-b border-[var(--sf-border)]" aria-busy="true">
        <div className="sf-container grid max-w-[1440px] min-h-[520px] gap-6 py-8 lg:grid-cols-2">
          <div className="space-y-4 self-center">
            <div className="h-3 w-40 animate-pulse rounded bg-[var(--sf-primary-light)]" />
            <div className="h-12 w-3/4 animate-pulse rounded bg-[var(--sf-primary-light)]" />
            <div className="h-20 w-full animate-pulse rounded bg-[var(--sf-primary-soft)]" />
            <div className="h-12 w-48 animate-pulse rounded-full bg-[var(--sf-primary-light)]" />
          </div>
          <div className="min-h-[280px] animate-pulse rounded-3xl bg-[var(--sf-primary-soft)]" />
        </div>
      </section>
    )
  }

  const slide = slides[active] ?? FALLBACK_SLIDE

  return (
    <section
      className="hero-luxury relative overflow-x-hidden border-b border-[var(--sf-border)]"
      aria-roledescription="carousel"
      aria-label="Homepage campaigns"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="hero-grain pointer-events-none absolute inset-0" aria-hidden />

      <div
        key={slide.id}
        role="group"
        aria-roledescription="slide"
        aria-label={`${active + 1} of ${slides.length}`}
      >
        <HeroSlidePanel
          slide={slide}
          isPrimaryHeading={active === 0}
          showTrending={slide.show_trending_products}
        />
      </div>

      {slides.length > 1 ? (
        <div className="sf-container flex max-w-[1440px] items-center justify-between gap-4 pb-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous slide"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--sf-border)] bg-white text-[var(--sf-ink)] transition hover:border-[var(--sf-primary)] hover:text-[var(--sf-primary)]"
              onClick={() => goTo(active - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Next slide"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--sf-border)] bg-white text-[var(--sf-ink)] transition hover:border-[var(--sf-primary)] hover:text-[var(--sf-primary)]"
              onClick={() => goTo(active + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === active ? 'true' : undefined}
                onClick={() => goTo(i)}
                className={cn(
                  'h-2.5 rounded-full transition-all',
                  i === active
                    ? 'w-10 bg-[var(--sf-primary)]'
                    : 'w-3 bg-[var(--sf-rose)] hover:bg-[var(--sf-primary)]/50',
                )}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
