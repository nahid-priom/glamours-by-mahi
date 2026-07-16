import { memo } from 'react'
import type { HeroSlide } from '@/lib/product-images'
import { cn } from '@/lib/utils'

interface HeroContentProps {
  slide: HeroSlide
  visible?: boolean
}

export const HeroContent = memo(function HeroContent({ slide, visible = true }: HeroContentProps) {
  return (
    <div
      className={cn(
        'transition-all duration-500 ease-out',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
      )}
    >
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-[var(--sf-primary)]">
          {slide.badgeTop}
        </p>
        <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-[var(--sf-muted)]">
          {slide.badgeBottom}
        </p>
      </div>

      <h1 className="mt-5 font-serif text-[2rem] font-normal leading-[1.05] text-[var(--sf-ink)] sm:text-5xl lg:text-[3.5rem]">
        <span className="block">{slide.headline[0]}</span>
        <span className="mt-1 block text-[var(--sf-primary)]">{slide.headline[1]}</span>
      </h1>

      <p className="mt-5 max-w-[480px] text-sm leading-relaxed text-[var(--sf-muted)] sm:text-base">
        {slide.subtitle}
      </p>
    </div>
  )
})
