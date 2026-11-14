import { ProductImage } from '@/components/common/ProductImage'
import { enterpriseReadable } from '@/components/enterprise-readable'
import { cn } from '@/lib/utils'
import { formatLineMoney, formatLineQty } from './format'
import type { TransactionLineItemView } from './types'

type Props = {
  item: TransactionLineItemView
  showImage?: boolean
  showDiscount?: boolean
  unitPriceLabel?: string
  className?: string
}

export function TransactionLineItemMobileCard({
  item,
  showImage = true,
  showDiscount = false,
  unitPriceLabel = 'Price',
  className,
}: Props) {
  const discount = Number(item.lineDiscount ?? 0)

  return (
    <article
      className={cn('border-b border-border px-4 py-3 last:border-b-0', className)}
    >
      <div className="flex items-start gap-3">
        {showImage ? (
          <ProductImage
            product={{
              id: item.productId ?? item.id,
              name: item.productName,
              image_url: item.imageUrl,
            }}
            className="h-11 w-11 shrink-0 rounded-lg"
          />
        ) : null}
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
        <p className={enterpriseReadable.quantity}>Qty {formatLineQty(item.qty)}</p>
        <p className={cn(enterpriseReadable.unitPrice, 'whitespace-nowrap')}>
          <span className="sr-only">{unitPriceLabel} </span>
          {formatLineMoney(item.unitPrice)}
        </p>
      </div>

      {showDiscount && discount > 0 ? (
        <div className="mt-1.5 flex items-baseline justify-between gap-3">
          <span className={enterpriseReadable.lineTotalLabel}>Discount</span>
          <span className={cn(enterpriseReadable.unitPrice, 'whitespace-nowrap')}>
            {formatLineMoney(discount)}
          </span>
        </div>
      ) : null}

      <div className="mt-2 flex items-baseline justify-between gap-3">
        <span className={enterpriseReadable.lineTotalLabel}>Line total</span>
        <span className={cn(enterpriseReadable.lineTotal, 'whitespace-nowrap')}>
          {formatLineMoney(item.lineTotal)}
        </span>
      </div>
    </article>
  )
}
