import { memo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HeroCtaButtonsProps {
  visible?: boolean
  className?: string
}

export const HeroCtaButtons = memo(function HeroCtaButtons({
  visible = true,
  className,
}: HeroCtaButtonsProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 transition-all duration-500 delay-75 sm:flex-row sm:flex-wrap',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
        className,
      )}
    >
      <Link
        to="/shop"
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--sf-primary)] px-8 text-sm font-semibold text-white shadow-[0_12px_30px_-12px_rgba(255,63,127,0.65)] transition hover:-translate-y-0.5 hover:bg-[var(--sf-primary-hover)] sm:w-auto sm:h-14"
      >
        Shop Now
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
      <Link
        to="/category/new-arrival"
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-[var(--sf-border)] bg-white/70 px-8 text-sm font-semibold text-[var(--sf-ink)] transition hover:border-[var(--sf-primary)] hover:bg-[var(--sf-primary-soft)] sm:w-auto sm:h-14"
      >
        Explore New Arrivals
      </Link>
    </div>
  )
})
