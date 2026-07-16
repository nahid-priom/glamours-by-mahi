import { memo } from 'react'
import { cn } from '@/lib/utils'

interface HeroSlideIndicatorsProps {
  count: number
  active: number
  onSelect: (index: number) => void
}

export const HeroSlideIndicators = memo(function HeroSlideIndicators({
  count,
  active,
  onSelect,
}: HeroSlideIndicatorsProps) {
  return (
    <div className="mt-10 flex items-center gap-2">
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          aria-label={`Go to slide ${i + 1}`}
          aria-current={i === active ? 'true' : undefined}
          onClick={() => onSelect(i)}
          className={cn(
            'h-2.5 rounded-full transition-all duration-300',
            i === active
              ? 'w-10 bg-[var(--sf-primary)]'
              : 'w-3 bg-[var(--sf-rose)] hover:bg-[var(--sf-primary)]/50',
          )}
        />
      ))}
    </div>
  )
})
