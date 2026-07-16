import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, Copy, Eye, Pencil, Power, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { HeroSlideRow } from '../types/hero.types'
import { heroService } from '../services/hero.service'
import { HERO_CTA_TYPE_LABELS } from '../types/hero.types'

interface HeroSlideCardProps {
  slide: HeroSlideRow
  onMoveUp: () => void
  onMoveDown: () => void
  onToggleActive: () => void
  onDuplicate: () => void
  onArchive: () => void
  busy?: boolean
}

export function HeroSlideCard({
  slide,
  onMoveUp,
  onMoveDown,
  onToggleActive,
  onDuplicate,
  onArchive,
  busy,
}: HeroSlideCardProps) {
  const thumb = heroService.mediaUrl(slide.desktop_image_path)

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-[var(--sf-border)] bg-white p-4 shadow-sm sm:flex-row">
      <div className="h-28 w-full shrink-0 overflow-hidden rounded-xl bg-[var(--sf-primary-soft)] sm:w-40">
        {thumb ? (
          <img src={thumb} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-[var(--sf-muted)]">
            No image
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs text-[var(--sf-muted)]">{slide.internal_name}</p>
            <h3 className="font-serif text-lg text-[var(--sf-ink)]">{slide.heading}</h3>
            <p className="mt-1 text-xs text-[var(--sf-muted)]">
              {HERO_CTA_TYPE_LABELS[slide.primary_cta_type]} ·{' '}
              {slide.layout_direction === 'content_left' ? 'Content left' : 'Content right'} · Order{' '}
              {slide.sort_order}
            </p>
          </div>
          <span
            className={cn(
              'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide',
              slide.status === 'active' && 'bg-emerald-50 text-emerald-700',
              slide.status === 'draft' && 'bg-amber-50 text-amber-700',
              slide.status === 'inactive' && 'bg-slate-100 text-slate-600',
              slide.status === 'archived' && 'bg-rose-50 text-rose-700',
            )}
          >
            {slide.status}
          </span>
        </div>

        <p className="mt-2 truncate text-sm text-[var(--sf-muted)]">
          CTA → {slide.primary_cta_url || '/shop'}
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Button asChild size="sm" variant="outline" className="rounded-full">
            <Link to={`/settings/website/hero/${slide.id}/preview`}>
              <Eye className="h-3.5 w-3.5" /> Preview
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="rounded-full">
            <Link to={`/settings/website/hero/${slide.id}`}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            disabled={busy}
            onClick={onToggleActive}
          >
            <Power className="h-3.5 w-3.5" />
            {slide.status === 'active' ? 'Deactivate' : 'Activate'}
          </Button>
          <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={onDuplicate}>
            <Copy className="h-3.5 w-3.5" /> Duplicate
          </Button>
          <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={onMoveUp}>
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={onMoveDown}>
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full text-[var(--sf-primary)]"
            disabled={busy}
            onClick={onArchive}
          >
            <Trash2 className="h-3.5 w-3.5" /> Archive
          </Button>
        </div>
      </div>
    </article>
  )
}
