import { cn } from '@/lib/utils'
import { brandConfig } from '@/config/brand'

type Props = {
  variant?: 'stacked' | 'inline' | 'compact'
  className?: string
  animate?: boolean
  light?: boolean
}

export function BrandMark({ variant = 'stacked', className, animate = false, light = false }: Props) {
  const titleClass = light ? 'text-white' : 'text-[#111827]'
  const subClass = light ? 'text-white/60' : 'text-[#6B7280]'

  if (variant === 'inline') {
    return (
      <span className={cn('font-serif text-base font-semibold tracking-wide', titleClass, className)}>
        <span className={cn(animate && 'brand-gradient-text')}>{brandConfig.displayLine1}</span>{' '}
        <span className={cn(!animate && 'text-[#E11D48]')}>{brandConfig.displayLine2}</span>
      </span>
    )
  }

  if (variant === 'compact') {
    return (
      <div className={cn('min-w-0', className)}>
        <p
          className={cn(
            'truncate text-sm font-bold leading-tight',
            animate ? 'brand-gradient-text' : light ? 'text-white' : titleClass,
          )}
        >
          {brandConfig.shortName}
        </p>
        <p className={cn('truncate text-[10px]', subClass)}>{brandConfig.displayLine2}</p>
      </div>
    )
  }

  return (
    <div className={cn('min-w-0', className)}>
      <p
        className={cn(
          'text-[10px] font-semibold uppercase tracking-[0.28em]',
          animate ? 'brand-gradient-text' : subClass,
        )}
      >
        {brandConfig.displayLine1}
      </p>
      <p
        className={cn(
          'mt-0.5 font-serif text-xl font-semibold tracking-[0.18em]',
          light ? 'text-white' : titleClass,
        )}
      >
        {brandConfig.displayLine2}
      </p>
    </div>
  )
}
