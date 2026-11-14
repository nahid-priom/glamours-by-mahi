import { TransactionLineItemMobileCard } from '@/components/transaction-line-items'
import type { SaleItemViewModel } from './sale-item.types'

type SaleItemMobileCardProps = {
  item: SaleItemViewModel
  className?: string
}

export function SaleItemMobileCard({ item, className }: SaleItemMobileCardProps) {
  return (
    <TransactionLineItemMobileCard
      item={{
        id: item.id,
        productName: item.productName,
        metadata: item.metadata || undefined,
        productId: item.productId,
        imageUrl: item.imageUrl,
        qty: item.qty,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      }}
      showImage
      className={className}
    />
  )
}
