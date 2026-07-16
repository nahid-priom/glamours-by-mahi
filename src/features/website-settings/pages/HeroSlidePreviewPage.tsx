import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useHeroSlide } from '../hooks/useHeroSlides'
import { resolveCtaHref } from '../services/hero-link-builder.service'
import { heroService } from '../services/hero.service'
import { cn } from '@/lib/utils'

export function HeroSlidePreviewPage() {
  const { id } = useParams()
  const { data: slide, isLoading } = useHeroSlide(id)

  if (isLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-[420px] w-full rounded-2xl" />
      </div>
    )
  }

  if (!slide) {
    return (
      <div className="p-6 text-center text-sm text-[var(--sf-muted)]">Slide not found.</div>
    )
  }

  const desktop = heroService.mediaUrl(slide.desktop_image_path)
  const mobile = heroService.mediaUrl(slide.mobile_image_path) || desktop
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
  const contentLeft = slide.layout_direction === 'content_left'

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link to={`/settings/website/hero/${slide.id}`}>
              <ArrowLeft className="h-4 w-4" /> Back to editor
            </Link>
          </Button>
          <h1 className="font-serif text-2xl">Preview · {slide.internal_name}</h1>
          <p className="text-sm text-[var(--sf-muted)]">
            Status: {slide.status} · Desktop / tablet / mobile frames
          </p>
        </div>
      </div>

      {(['desktop', 'tablet', 'mobile'] as const).map((frame) => (
        <div key={frame} className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--sf-muted)]">
            {frame}
          </p>
          <div
            className={cn(
              'overflow-hidden rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-bg)]',
              frame === 'desktop' && 'max-w-5xl',
              frame === 'tablet' && 'max-w-2xl',
              frame === 'mobile' && 'max-w-sm',
            )}
          >
            <div
              className={cn(
                'grid min-h-[320px]',
                frame === 'mobile' ? 'grid-cols-1' : 'lg:grid-cols-2',
                !contentLeft && frame !== 'mobile' && '[direction:rtl] [&_*]:[direction:ltr]',
              )}
            >
              <div className="flex flex-col justify-center gap-3 p-6">
                {slide.eyebrow ? (
                  <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--sf-primary)]">
                    {slide.eyebrow}
                  </p>
                ) : null}
                <h2 className="font-serif text-3xl text-[var(--sf-ink)]">
                  {slide.heading}{' '}
                  {slide.highlight_text ? (
                    <span className="text-[var(--sf-primary)]">{slide.highlight_text}</span>
                  ) : null}
                </h2>
                {slide.description ? (
                  <p className="text-sm text-[var(--sf-muted)]">{slide.description}</p>
                ) : null}
                {slide.discount_text || slide.coupon_code ? (
                  <p className="text-sm font-semibold text-[var(--sf-primary)]">
                    {[slide.discount_text, slide.coupon_code ? `Code: ${slide.coupon_code}` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2 pt-2">
                  <a
                    href={primaryHref}
                    className="rounded-full bg-[var(--sf-primary)] px-4 py-2 text-xs font-semibold text-white"
                  >
                    {slide.primary_cta_label}
                  </a>
                  {slide.secondary_cta_enabled && slide.secondary_cta_label ? (
                    <a
                      href={secondaryHref}
                      className="rounded-full border border-[var(--sf-border)] bg-white px-4 py-2 text-xs font-semibold"
                    >
                      {slide.secondary_cta_label}
                    </a>
                  ) : null}
                </div>
              </div>
              <div className="relative min-h-[220px] bg-[var(--sf-primary-soft)]">
                {(frame === 'mobile' ? mobile : desktop) ? (
                  <img
                    src={(frame === 'mobile' ? mobile : desktop) ?? undefined}
                    alt={slide.image_alt ?? slide.heading}
                    className="h-full w-full object-cover"
                    style={{
                      objectPosition:
                        slide.image_object_position === 'custom' &&
                        slide.image_focal_x != null &&
                        slide.image_focal_y != null
                          ? `${slide.image_focal_x}% ${slide.image_focal_y}%`
                          : slide.image_object_position,
                    }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-[var(--sf-muted)]">
                    Upload a cover image
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
