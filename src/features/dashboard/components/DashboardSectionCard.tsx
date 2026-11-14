import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface DashboardSectionCardProps {
  title: ReactNode
  action?: { label: string; to: string }
  children: ReactNode
  className?: string
  bodyClassName?: string
}

export function DashboardSectionCard({
  title,
  action,
  children,
  className,
  bodyClassName,
}: DashboardSectionCardProps) {
  return (
    <div
      className={cn(
        'flex h-full flex-col rounded-2xl border border-[#E5E7EB] bg-white shadow-sm',
        className,
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#F1F5F9] px-4 py-2.5">
        <h2 className="text-sm font-semibold text-[#111111]">{title}</h2>
        {action && (
          <Link to={action.to} className="text-[11px] font-semibold text-[#E11D48] hover:underline">
            {action.label}
          </Link>
        )}
      </div>
      <div className={cn('flex-1 p-3', bodyClassName)}>{children}</div>
    </div>
  )
}
