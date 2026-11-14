import { TransactionLineItemsTable } from '@/components/transaction-line-items'
import type { SaleItemViewModel } from './sale-item.types'

type SaleItemsTableProps = {
  items: SaleItemViewModel[]
  className?: string
}

export function SaleItemsTable({ items, className }: SaleItemsTableProps) {
  return (
    <TransactionLineItemsTable
      items={items.map((item) => ({
        id: item.id,
        productName: item.productName,
        metadata: item.metadata || undefined,
        productId: item.productId,
        imageUrl: item.imageUrl,
        qty: item.qty,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      }))}
      showImage
      className={className}
    />
  )
}
