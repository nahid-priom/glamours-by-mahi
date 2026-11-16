import { Link } from 'react-router-dom'
import { ExternalLink, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { useHeroSlideMutations, useHeroSlides } from '../hooks/useHeroSlides'
import { heroService } from '../services/hero.service'
import { HeroSlideCard } from './HeroSlideCard'
import { toastRpcError } from '@/lib/errors/rpc-error'

export function HeroSlideList() {
  const { data: slides = [], isLoading, isError } = useHeroSlides()
  const mutations = useHeroSlideMutations()
  const { toast } = useToast()
  const kpis = heroService.kpis(slides)

  const move = async (index: number, direction: -1 | 1) => {
    const next = [...slides]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    try {
      await mutations.reorder.mutateAsync(next.map((s) => s.id))
      toast('Order saved', 'success')
    } catch (e) {
      toastRpcError(toast, e, 'Reorder failed')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-36 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <p className="rounded-2xl border border-dashed border-[var(--sf-border)] p-8 text-center text-sm text-[var(--sf-muted)]">
        Could not load hero slides. Check permissions and try again.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl text-[var(--sf-ink)]">Hero Carousel</h2>
          <p className="mt-1 text-sm text-[var(--sf-muted)]">
            Manage homepage banners, campaign content and shop links.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="rounded-full">
            <a href="/" target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" /> Preview Homepage
            </a>
          </Button>
          <Button asChild className="rounded-full">
            <Link to="/settings/website/hero/new">
              <Plus className="h-4 w-4" /> Add Hero Slide
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total Slides', value: kpis.total },
          { label: 'Active', value: kpis.active },
          { label: 'Scheduled', value: kpis.scheduled },
          { label: 'Inactive / Draft', value: kpis.inactive },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-[var(--sf-border)] bg-white p-4"
          >
            <p className="text-xs uppercase tracking-wide text-[var(--sf-muted)]">{item.label}</p>
            <p className="mt-2 font-serif text-3xl text-[var(--sf-ink)]">{item.value}</p>
          </div>
        ))}
      </div>

      {slides.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--sf-border)] bg-white p-12 text-center">
          <p className="font-medium text-[var(--sf-ink)]">No hero slides have been created.</p>
          <p className="mt-1 text-sm text-[var(--sf-muted)]">
            Create your first homepage campaign banner.
          </p>
          <Button asChild className="mt-5 rounded-full">
            <Link to="/settings/website/hero/new">
              <Plus className="h-4 w-4" /> Add Hero Slide
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {slides.map((slide, index) => (
            <HeroSlideCard
              key={slide.id}
              slide={slide}
              busy={
                mutations.setStatus.isPending ||
                mutations.duplicate.isPending ||
                mutations.archive.isPending ||
                mutations.reorder.isPending
              }
              onMoveUp={() => void move(index, -1)}
              onMoveDown={() => void move(index, 1)}
              onToggleActive={() =>
                void mutations.setStatus
                  .mutateAsync({
                    id: slide.id,
                    status: slide.status === 'active' ? 'inactive' : 'active',
                  })
                  .then(() => toast('Status updated', 'success'))
                  .catch((e: Error) => toastRpcError(toast, e))
              }
              onDuplicate={() =>
                void mutations.duplicate
                  .mutateAsync(slide.id)
                  .then(() => toast('Slide duplicated', 'success'))
                  .catch((e: Error) => toastRpcError(toast, e))
              }
              onArchive={() =>
                void mutations.archive
                  .mutateAsync(slide.id)
                  .then(() => toast('Slide archived', 'success'))
                  .catch((e: Error) => toastRpcError(toast, e))
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
