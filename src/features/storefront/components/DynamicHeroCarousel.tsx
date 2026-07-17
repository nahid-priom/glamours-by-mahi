import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  FocusEvent as ReactFocusEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useActiveHeroSlides } from '@/features/website-settings/hooks/useHeroSlides'
import { resolveCtaHref } from '@/features/website-settings/services/hero-link-builder.service'
import type { PublicHeroSlide } from '@/features/website-settings/types/hero.types'

const AUTOPLAY_INTERVAL_MS = 6000
const DRAG_THRESHOLD_PX = 48
const CLICK_SUPPRESS_PX = 8

function isExternalUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://')
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

function SlideMedia({ slide, index }: { slide: PublicHeroSlide; index: number }) {
  return (
    <picture className="block h-full w-full">
      {slide.mobile_image_url ? (
        <source media="(max-width: 639px)" srcSet={slide.mobile_image_url} />
      ) : null}
      {slide.tablet_image_url ? (
        <source media="(max-width: 1023px)" srcSet={slide.tablet_image_url} />
      ) : null}
      <img
        src={slide.desktop_image_url ?? undefined}
        alt={slide.image_alt || 'Promotional banner'}
        className="h-full w-full object-cover"
        style={{ objectPosition: objectPosition(slide) }}
        loading={index === 0 ? 'eager' : 'lazy'}
        fetchPriority={index === 0 ? 'high' : 'auto'}
        decoding="async"
        draggable={false}
      />
    </picture>
  )
}

function CoverSlide({
  slide,
  index,
  count,
}: {
  slide: PublicHeroSlide
  index: number
  count: number
}) {
  const href = resolveCtaHref(
    slide.primary_cta_type,
    slide.primary_cta_config,
    slide.primary_cta_url,
  )
  const media = <SlideMedia slide={slide} index={index} />

  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={`Slide ${index + 1} of ${count}`}
      className="relative h-full w-full shrink-0"
    >
      {href ? (
        isExternalUrl(href) ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="block h-full w-full focus-visible:outline-2 focus-visible:outline-[var(--sf-primary)]"
            aria-label={slide.image_alt || `Open promotion ${index + 1}`}
            draggable={false}
          >
            {media}
          </a>
        ) : (
          <Link
            to={href}
            target={slide.primary_cta_new_tab ? '_blank' : undefined}
            rel={slide.primary_cta_new_tab ? 'noreferrer' : undefined}
            className="block h-full w-full focus-visible:outline-2 focus-visible:outline-[var(--sf-primary)]"
            aria-label={slide.image_alt || `Open promotion ${index + 1}`}
            draggable={false}
          >
            {media}
          </Link>
        )
      ) : (
        media
      )}
    </div>
  )
}

export function DynamicHeroCarousel() {
  const { data, isLoading } = useActiveHeroSlides()
  const slides = useMemo(
    () => (data ?? []).filter((slide) => Boolean(slide.desktop_image_url)),
    [data],
  )
  const count = slides.length

  const [active, setActive] = useState(0)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)
  const dragStateRef = useRef<{ pointerId: number; startX: number } | null>(null)
  const suppressClickRef = useRef(false)

  const paused = hovered || focused || dragging

  useEffect(() => {
    if (active >= count && count > 0) setActive(0)
  }, [active, count])

  const goTo = useCallback(
    (index: number) => {
      if (count === 0) return
      setActive(((index % count) + count) % count)
    },
    [count],
  )

  useEffect(() => {
    if (count <= 1 || paused) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const id = window.setInterval(() => {
      if (document.hidden) return
      setActive((prev) => (prev + 1) % count)
    }, AUTOPLAY_INTERVAL_MS)

    return () => window.clearInterval(id)
  }, [count, paused])

  const endDrag = useCallback(
    (clientX: number) => {
      const state = dragStateRef.current
      if (!state) return
      dragStateRef.current = null

      const delta = clientX - state.startX
      suppressClickRef.current = Math.abs(delta) > CLICK_SUPPRESS_PX
      setDragOffset(0)
      setDragging(false)
      if (Math.abs(delta) > DRAG_THRESHOLD_PX) {
        goTo(active + (delta < 0 ? 1 : -1))
      }
    },
    [active, goTo],
  )

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (count <= 1) return
    dragStateRef.current = { pointerId: e.pointerId, startX: e.clientX }
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current
    if (!state || state.pointerId !== e.pointerId) return
    setDragOffset(e.clientX - state.startX)
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current?.pointerId !== e.pointerId) return
    endDrag(e.clientX)
  }

  const onPointerCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current?.pointerId !== e.pointerId) return
    dragStateRef.current = null
    setDragOffset(0)
    setDragging(false)
  }

  const onClickCapture = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return
    suppressClickRef.current = false
    e.preventDefault()
    e.stopPropagation()
  }

  const onBlur = (e: ReactFocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false)
  }

  if (isLoading) {
    return (
      <section className="w-full bg-white" aria-busy="true" aria-label="Loading promotions">
        <div className="sf-container max-w-[1440px] pt-2 sm:pt-4">
          <div className="aspect-[16/9] w-full animate-pulse rounded-xl bg-[var(--sf-primary-soft)] sm:rounded-2xl lg:aspect-auto lg:h-[455px] xl:h-[505px]" />
        </div>
      </section>
    )
  }

  if (count === 0) return null

  // Only switch to the tall 4:5 mobile ratio when every slide has a mobile cover,
  // otherwise the container would jump between ratios while sliding.
  const hasMobileCover = slides.every((slide) => Boolean(slide.mobile_image_url))

  return (
    <section
      className="w-full bg-white"
      aria-roledescription="carousel"
      aria-label="Homepage promotions"
    >
      <div className="sf-container max-w-[1440px] pt-2 sm:pt-4">
        <div
          className={cn(
            'relative w-full overflow-hidden rounded-xl bg-[var(--sf-primary-soft)] shadow-sm ring-1 ring-black/5 sm:rounded-2xl',
            hasMobileCover ? 'aspect-square' : 'aspect-[16/9]',
            'sm:aspect-[16/9] lg:aspect-auto lg:h-[455px] xl:h-[505px]',
          )}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setFocused(true)}
          onBlur={onBlur}
        >
          <div
            className={cn(
              'flex h-full w-full',
              !dragging && 'transition-transform duration-500 ease-out',
            )}
            style={{
              transform: `translateX(calc(${-active * 100}% + ${dragOffset}px))`,
              touchAction: 'pan-y',
            }}
            aria-live={paused ? 'polite' : 'off'}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onClickCapture={onClickCapture}
          >
            {slides.map((slide, index) => (
              <CoverSlide key={slide.id} slide={slide} index={index} count={count} />
            ))}
          </div>

          {count > 1 ? (
            <>
              <button
                type="button"
                aria-label="Previous slide"
                onClick={() => goTo(active - 1)}
                className="absolute left-2 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/70 text-[var(--sf-ink)] shadow-sm ring-1 ring-black/5 backdrop-blur transition hover:bg-white sm:flex lg:left-3"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Next slide"
                onClick={() => goTo(active + 1)}
                className="absolute right-2 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/70 text-[var(--sf-ink)] shadow-sm ring-1 ring-black/5 backdrop-blur transition hover:bg-white sm:flex lg:right-3"
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>

              <div
                className="absolute bottom-2.5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 sm:bottom-3"
                role="tablist"
                aria-label="Slides"
              >
                {slides.map((slide, index) => (
                  <button
                    key={slide.id}
                    type="button"
                    role="tab"
                    aria-label={`Go to slide ${index + 1}`}
                    aria-selected={index === active}
                    onClick={() => goTo(index)}
                    className={cn(
                      'h-2 rounded-full ring-1 ring-black/10 transition-all',
                      index === active ? 'w-6 bg-white' : 'w-2 bg-white/60 hover:bg-white/90',
                    )}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  )
}
