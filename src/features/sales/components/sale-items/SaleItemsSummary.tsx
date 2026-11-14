import { cn } from '@/lib/utils'
import { enterpriseReadable } from './enterprise-readable'
import { formatSaleItemMoney } from './sale-item-presentation'

type SaleItemsSummaryProps = {
  itemCount: number
  grandTotal?: number
  className?: string
}

export function SaleItemsSummary({
  itemCount,
  grandTotal,
  className,
}: SaleItemsSummaryProps) {
  if (itemCount === 0) {
    return (
      <p
        className={cn(
          'px-4 py-8 text-center text-sm text-text-muted',
          className,
        )}
      >
        No items on this sale.
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
        {formatSaleItemMoney(grandTotal)}
      </span>
    </div>
  )
}
