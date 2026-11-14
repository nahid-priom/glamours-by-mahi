import { enterpriseReadable } from '@/components/enterprise-readable'
import { cn } from '@/lib/utils'
import { formatLineMoney } from './format'

type Props = {
  itemCount: number
  grandTotal?: number
  emptyMessage?: string
  className?: string
}

export function TransactionLineItemsSummary({
  itemCount,
  grandTotal,
  emptyMessage = 'No items on this document.',
  className,
}: Props) {
  if (itemCount === 0) {
    return (
      <p className={cn('px-4 py-8 text-center text-sm text-text-muted', className)}>
        {emptyMessage}
      </p>
    )
  }

  if (grandTotal === undefined) return null

  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-3 border-t border-border px-4 py-3',
        className,
      )}
    >
      <span className={enterpriseReadable.lineTotalLabel}>Grand total</span>
      <span className={cn(enterpriseReadable.grandTotal, 'whitespace-nowrap')}>
        {formatLineMoney(grandTotal)}
      </span>
    </div>
  )
}
