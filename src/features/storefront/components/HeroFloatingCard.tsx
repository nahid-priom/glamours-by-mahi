import { memo } from 'react'
import { cn } from '@/lib/utils'

export interface HeroFloatingCardProps {
  title: string
  subtitle: string
  className?: string
  delay?: number
}

export const HeroFloatingCard = memo(function HeroFloatingCard({
  title,
  subtitle,
  className,
  delay = 0,
}: HeroFloatingCardProps) {
  return (
    <div
      className={cn(
        'hero-float rounded-2xl border border-white/30 bg-white/70 px-4 py-3 shadow-2xl backdrop-blur-md',
        className,
      )}
      style={{ animationDelay: `${delay}s` }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-900">{subtitle}</p>
    </div>
  )
})
