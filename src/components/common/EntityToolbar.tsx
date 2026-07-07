import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface EntityToolbarProps {
  search: ReactNode
  filters?: ReactNode
  actions?: ReactNode
  className?: string
}

export function EntityToolbar({ search, filters, actions, className }: EntityToolbarProps) {
  return (
    <div className={cn('flex flex-col gap-3 lg:flex-row lg:items-center', className)}>
      <div className="min-w-0 flex-1 lg:w-1/2">{search}</div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:w-1/2 lg:justify-end">
        {filters}
        {actions}
      </div>
    </div>
  )
}
