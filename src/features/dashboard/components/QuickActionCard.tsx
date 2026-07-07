import { memo } from 'react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type QuickActionColor =
  | 'red'
  | 'blue'
  | 'indigo'
  | 'cyan'
  | 'orange'
  | 'purple'

const colorStyles: Record<
  QuickActionColor,
  { box: string; icon: string; ring: string }
> = {
  red: { box: 'bg-red-50', icon: 'text-red-500', ring: 'group-hover:shadow-red-100/80' },
  blue: { box: 'bg-blue-50', icon: 'text-blue-500', ring: 'group-hover:shadow-blue-100/80' },
  indigo: { box: 'bg-indigo-50', icon: 'text-indigo-500', ring: 'group-hover:shadow-indigo-100/80' },
  cyan: { box: 'bg-cyan-50', icon: 'text-cyan-500', ring: 'group-hover:shadow-cyan-100/80' },
  orange: { box: 'bg-orange-50', icon: 'text-orange-500', ring: 'group-hover:shadow-orange-100/80' },
  purple: { box: 'bg-purple-50', icon: 'text-purple-500', ring: 'group-hover:shadow-purple-100/80' },
}

export interface QuickActionCardProps {
  title: string
  icon: LucideIcon
  color: QuickActionColor
  route: string
}

export const QuickActionCard = memo(function QuickActionCard({
  title,
  icon: Icon,
  color,
  route,
}: QuickActionCardProps) {
  const styles = colorStyles[color]

  return (
    <Link
      to={route}
      className={cn(
        'group flex h-[78px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 shadow-sm',
        'transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md',
        styles.ring,
        'lg:h-auto lg:min-h-[52px] lg:flex-row lg:items-center lg:justify-center lg:gap-2.5 lg:px-3 lg:py-2.5',
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          'lg:h-9 lg:w-9',
          styles.box,
        )}
      >
        <Icon className={cn('h-5 w-5 lg:h-4 lg:w-4', styles.icon)} />
      </div>
      <h4 className="min-w-0 text-center text-sm font-semibold leading-tight text-slate-900 lg:whitespace-nowrap lg:text-left lg:text-[13px]">
        {title}
      </h4>
    </Link>
  )
})
