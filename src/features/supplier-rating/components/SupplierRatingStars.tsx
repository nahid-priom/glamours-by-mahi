import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SupplierRatingStatus } from '../repositories/supplier-rating.repository'

type SupplierRatingStarsProps = {
  score: number | null | undefined
  status?: SupplierRatingStatus
  size?: 'sm' | 'md'
  showNumeric?: boolean
  className?: string
}

export function SupplierRatingStars({
  score,
  status = score == null ? 'unrated' : 'rated',
  size = 'sm',
  showNumeric = true,
  className,
}: SupplierRatingStarsProps) {
  if (status === 'unrated' || score == null) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-xs text-[#9CA3AF]', className)}>
        Unrated
      </span>
    )
  }

  const clamped = Math.max(1, Math.min(5, Number.isFinite(score) ? score : 3))
  const starClass = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'

  return (
    <span
      className={cn('inline-flex items-center gap-1', className)}
      title={status === 'provisional' ? `Provisional ${clamped.toFixed(1)}` : `Rating ${clamped.toFixed(1)}`}
    >
      <span className="inline-flex items-center gap-0.5" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => {
          const fill = Math.max(0, Math.min(1, clamped - i))
          return (
            <span key={i} className="relative inline-flex">
              <Star className={cn(starClass, 'text-[#E5E7EB]')} />
              {fill > 0 ? (
                <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                  <Star className={cn(starClass, 'fill-amber-400 text-amber-400')} />
                </span>
              ) : null}
            </span>
          )
        })}
      </span>
      {showNumeric ? (
        <span className={cn('font-semibold text-[#111827]', size === 'sm' ? 'text-xs' : 'text-sm')}>
          {clamped.toFixed(1)}
          {status === 'provisional' ? (
            <span className="ml-1 font-normal text-[#9CA3AF]">prov.</span>
          ) : null}
        </span>
      ) : null}
      <span className="sr-only">
        {status === 'provisional' ? 'Provisional' : 'Supplier'} rating {clamped.toFixed(1)} out of 5
      </span>
    </span>
  )
}
