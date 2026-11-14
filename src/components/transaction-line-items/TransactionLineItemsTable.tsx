import { ProductImage } from '@/components/common/ProductImage'
import { enterpriseReadable } from '@/components/enterprise-readable'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { formatLineMoney, formatLineQty } from './format'
import type { TransactionLineItemView } from './types'

type Props = {
  items: TransactionLineItemView[]
  showImage?: boolean
  showDiscount?: boolean
  unitPriceLabel?: string
  discountLabel?: string
  className?: string
}

const headClass = cn('h-11 px-4', enterpriseReadable.tableHeader)
const cellClass = 'px-4 py-3 align-middle'

export function TransactionLineItemsTable({
  items,
  showImage = true,
  showDiscount = false,
  unitPriceLabel = 'Price',
  discountLabel = 'Discount',
  className,
}: Props) {
  const itemWidth = showDiscount ? 'w-[34%]' : 'w-[42%]'
  const moneyWidth = showDiscount ? 'w-[16%]' : 'w-[22%]'

  return (
    <Table className={cn('w-full table-fixed', className)}>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={cn(headClass, itemWidth, 'text-left')}>Item</TableHead>
          <TableHead className={cn(headClass, 'w-[12%] text-center')}>Qty</TableHead>
          <TableHead className={cn(headClass, moneyWidth, 'text-right')}>
            {unitPriceLabel}
          </TableHead>
          {showDiscount ? (
            <TableHead className={cn(headClass, 'w-[16%] text-right')}>
              {discountLabel}
            </TableHead>
          ) : null}
          <TableHead className={cn(headClass, moneyWidth, 'text-right')}>Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const discount = Number(item.lineDiscount ?? 0)
          return (
            <TableRow key={item.id} className="min-h-16">
              <TableCell className={cellClass}>
                <div className="flex items-center gap-3">
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
                  <div className="min-w-0">
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
              </TableCell>
              <TableCell
                className={cn(
                  cellClass,
                  enterpriseReadable.quantity,
                  'text-center whitespace-nowrap',
                )}
              >
                {formatLineQty(item.qty)}
              </TableCell>
              <TableCell
                className={cn(
                  cellClass,
                  enterpriseReadable.unitPrice,
                  'text-right whitespace-nowrap',
                )}
              >
                {formatLineMoney(item.unitPrice)}
              </TableCell>
              {showDiscount ? (
                <TableCell
                  className={cn(
                    cellClass,
                    enterpriseReadable.unitPrice,
                    'text-right whitespace-nowrap',
                  )}
                >
                  {discount > 0 ? formatLineMoney(discount) : '—'}
                </TableCell>
              ) : null}
              <TableCell
                className={cn(
                  cellClass,
                  enterpriseReadable.lineTotal,
                  'text-right whitespace-nowrap',
                )}
              >
                {formatLineMoney(item.lineTotal)}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
