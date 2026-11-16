import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { Skeleton } from '@/components/ui/skeleton'
import { HeroSlideForm } from '../components/HeroSlideForm'
import { useHeroSlide, useHeroSlideMutations } from '../hooks/useHeroSlides'
import type { HeroSlideFormValues } from '../schemas/hero.schema'
import { toastRpcError } from '@/lib/errors/rpc-error'

export function HeroSlideEditorPage() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const { toast } = useToast()
  const { data: slide, isLoading } = useHeroSlide(isNew ? undefined : id)
  const { create, update } = useHeroSlideMutations()

  const handleSubmit = async (values: HeroSlideFormValues) => {
    try {
      if (isNew) {
        const created = await create.mutateAsync(values)
        toast('Slide created. You can upload images now.', 'success')
        navigate(`/settings/website/hero/${created.id}`, { replace: true })
      } else if (id) {
        await update.mutateAsync({ id, values })
        toast('Slide saved', 'success')
      }
    } catch (e) {
      toastRpcError(toast, e, 'Save failed')
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link to="/settings/website">
              <ArrowLeft className="h-4 w-4" /> Back to Website Settings
            </Link>
          </Button>
          <h1 className="font-serif text-3xl text-[var(--sf-ink)]">
            {isNew ? 'Add Hero Slide' : 'Edit Hero Slide'}
          </h1>
        </div>
        {!isNew && id ? (
          <Button asChild variant="outline" className="rounded-full">
            <Link to={`/settings/website/hero/${id}/preview`}>Preview</Link>
          </Button>
        ) : null}
      </div>

      {!isNew && isLoading ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : (
        <HeroSlideForm
          slide={isNew ? null : slide}
          slideId={isNew ? undefined : id}
          onSubmit={handleSubmit}
          submitting={create.isPending || update.isPending}
        />
      )}
    </div>
  )
}
