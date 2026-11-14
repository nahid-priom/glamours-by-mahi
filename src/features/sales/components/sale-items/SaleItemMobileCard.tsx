import { ProductImage } from '@/components/common/ProductImage'
import { cn } from '@/lib/utils'
import { enterpriseReadable } from './enterprise-readable'
import {
  formatSaleItemMoney,
  formatSaleItemQty,
} from './sale-item-presentation'
import type { SaleItemViewModel } from './sale-item.types'

type SaleItemMobileCardProps = {
  item: SaleItemViewModel
  className?: string
}

export function SaleItemMobileCard({ item, className }: SaleItemMobileCardProps) {
  return (
    <article
      className={cn(
        'border-b border-border px-4 py-3 last:border-b-0',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <ProductImage
          product={{
            id: item.productId,
            name: item.productName,
            image_url: item.imageUrl,
          }}
          className="h-11 w-11 shrink-0 rounded-lg"
        />
        <div className="min-w-0 flex-1">
          <p className={cn(enterpriseReadable.productName, 'break-words')}>
            {item.productName}
          </p>
          {item.metadata ? (
            <p className={cn(enterpriseReadable.metadata, 'mt-0.5 break-words')}>
              {item.metadata}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className={enterpriseReadable.quantity}>
          Qty {formatSaleItemQty(item.qty)}
        </p>
        <p className={cn(enterpriseReadable.unitPrice, 'whitespace-nowrap')}>
          {formatSaleItemMoney(item.unitPrice)}
        </p>
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-3">
        <span className={enterpriseReadable.lineTotalLabel}>Line total</span>
        <span className={cn(enterpriseReadable.lineTotal, 'whitespace-nowrap')}>
          {formatSaleItemMoney(item.lineTotal)}
        </span>
      </div>
    </article>
  )
}
