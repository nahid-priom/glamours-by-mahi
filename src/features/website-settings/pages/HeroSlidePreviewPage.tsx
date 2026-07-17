import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useHeroSlide } from '../hooks/useHeroSlides'
import { resolveCtaHref } from '../services/hero-link-builder.service'
import { heroService } from '../services/hero.service'

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
  const tablet = heroService.mediaUrl(slide.tablet_image_path)
  const mobile = heroService.mediaUrl(slide.mobile_image_path)
  const href = resolveCtaHref(
    slide.primary_cta_type,
    slide.primary_cta_config,
    slide.primary_cta_url,
  )
  const focalPosition =
    slide.image_object_position === 'custom' &&
    slide.image_focal_x != null &&
    slide.image_focal_y != null
      ? `${slide.image_focal_x}% ${slide.image_focal_y}%`
      : slide.image_object_position || 'center'

  const frames = [
    {
      key: 'desktop',
      label: 'Desktop · 16:7',
      src: desktop,
      ratio: '16 / 7',
      maxWidth: 'max-w-5xl',
    },
    {
      key: 'tablet',
      label: tablet ? 'Tablet · 16:9' : 'Tablet · desktop fallback (16:9)',
      src: tablet ?? desktop,
      ratio: '16 / 9',
      maxWidth: 'max-w-2xl',
    },
    {
      key: 'mobile',
      label: mobile ? 'Mobile · 4:5' : 'Mobile · fallback (16:9)',
      src: mobile ?? tablet ?? desktop,
      ratio: mobile ? '4 / 5' : '16 / 9',
      maxWidth: 'max-w-sm',
    },
  ]

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
            Status: {slide.status} · Link: {href || 'None (non-clickable)'}
          </p>
        </div>
      </div>

      {frames.map((frame) => (
        <div key={frame.key} className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--sf-muted)]">
            {frame.label}
          </p>
          <div
            className={`w-full overflow-hidden rounded-2xl border border-[var(--sf-border)] bg-white ${frame.maxWidth}`}
            style={{ aspectRatio: frame.ratio }}
          >
            {frame.src ? (
              <img
                src={frame.src}
                alt={slide.image_alt ?? slide.internal_name}
                className="h-full w-full object-cover"
                style={{ objectPosition: focalPosition }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-[var(--sf-muted)]">
                Upload a cover image
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
