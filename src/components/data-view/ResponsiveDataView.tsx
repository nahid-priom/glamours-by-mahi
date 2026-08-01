import type { ReactNode } from 'react'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingCardSkeleton } from './LoadingCardSkeleton'
import { cn } from '@/lib/utils'

interface ResponsiveDataViewProps<T> {
  items: T[]
  getKey: (item: T) => string
  /** Desktop / tablet comparison table */
  renderTable: (items: T[]) => ReactNode
  /** Mobile card for each row — same dataset, no second fetch */
  renderCard: (item: T) => ReactNode
  isLoading?: boolean
  error?: Error | null | string
  emptyTitle?: string
  emptyDescription?: string
  className?: string
  skeletonCount?: number
}

export function ResponsiveDataView<T>({
  items,
  getKey,
  renderTable,
  renderCard,
  isLoading,
  error,
  emptyTitle = 'No records found',
  emptyDescription = 'Try adjusting filters or date range.',
  className,
  skeletonCount = 4,
}: ResponsiveDataViewProps<T>) {
  if (isLoading) {
    return (
      <div className={className}>
        <div className="hidden md:block">
          <div className="h-48 animate-pulse rounded-xl border border-border bg-slate-50" />
        </div>
        <div className="md:hidden">
          <LoadingCardSkeleton count={skeletonCount} />
        </div>
      </div>
    )
  }

  if (error) {
    const message = typeof error === 'string' ? error : error.message
    return (
      <EmptyState
        title="Could not load data"
        description={message || 'Please try again.'}
      />
    )
  }

  if (!items.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />
  }

  return (
    <div className={cn(className)}>
      <div className="hidden md:block">{renderTable(items)}</div>
      <div className="space-y-3 md:hidden">
        {items.map((item) => (
          <div key={getKey(item)}>{renderCard(item)}</div>
        ))}
      </div>
    </div>
  )
}
