import { TransactionLineItemsSummary } from '@/components/transaction-line-items'

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
  return (
    <TransactionLineItemsSummary
      itemCount={itemCount}
      grandTotal={grandTotal}
      emptyMessage="No items on this sale."
      className={className}
    />
  )
}
