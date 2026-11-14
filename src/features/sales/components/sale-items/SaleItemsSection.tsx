import { TransactionLineItemsSection } from '@/components/transaction-line-items'
import { toSaleItemViewModel } from './sale-item-presentation'
import type { SaleDetailLineItem } from './sale-item.types'

type SaleItemsSectionProps = {
  items: SaleDetailLineItem[]
  grandTotal?: number
  className?: string
}

export function SaleItemsSection({
  items,
  grandTotal,
  className,
}: SaleItemsSectionProps) {
  const viewItems = items.map((item) => {
    const vm = toSaleItemViewModel(item)
    return {
      id: vm.id,
      productName: vm.productName,
      metadata: vm.metadata || undefined,
      productId: vm.productId,
      imageUrl: vm.imageUrl,
      qty: vm.qty,
      unitPrice: vm.unitPrice,
      lineTotal: vm.lineTotal,
    }
  })

  return (
    <TransactionLineItemsSection
      items={viewItems}
      grandTotal={grandTotal}
      showImage
      showDiscount={false}
      labels={{
        unitPrice: 'Price',
        empty: 'No items on this sale.',
      }}
      headingId="sale-items-heading"
      className={className}
    />
  )
}
