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
  red: { box: 'bg-[#FFF1F2]', icon: 'text-[#E11D48]', ring: 'group-hover:shadow-rose-100/80' },
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
  /** Highlight tile (e.g. New Sale POS) */
  featured?: boolean
}

export const QuickActionCard = memo(function QuickActionCard({
  title,
  icon: Icon,
  color,
  route,
  featured = false,
}: QuickActionCardProps) {
  const styles = colorStyles[color]

  return (
    <Link
      to={route}
      className={cn(
        'group flex min-h-[64px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border bg-white px-2 py-2 shadow-sm',
        'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
        styles.ring,
        featured
          ? 'border-[#E11D48]/50 bg-[#FFF1F2]/60 ring-1 ring-[#E11D48]/15'
          : 'border-slate-200 hover:border-slate-300',
      )}
    >
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          featured ? 'bg-[#E11D48]/10' : styles.box,
        )}
      >
        <Icon className={cn('h-4 w-4', featured ? 'text-[#E11D48]' : styles.icon)} />
      </div>
      <h4 className="min-w-0 text-center text-[11px] font-semibold leading-tight text-slate-900 sm:text-xs">
        {title}
      </h4>
    </Link>
  )
})
