import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { PageHeader } from './PageHeader'

interface PageShellProps {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
}

export function PageShell({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: PageShellProps) {
  return (
    <div className={cn('space-y-5', className)}>
      <PageHeader title={title} description={description} actions={actions} />
      <div className={cn('space-y-5', contentClassName)}>{children}</div>
    </div>
  )
}
