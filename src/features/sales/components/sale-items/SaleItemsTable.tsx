import { ProductImage } from '@/components/common/ProductImage'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { enterpriseReadable } from './enterprise-readable'
import {
  formatSaleItemMoney,
  formatSaleItemQty,
} from './sale-item-presentation'
import type { SaleItemViewModel } from './sale-item.types'

type SaleItemsTableProps = {
  items: SaleItemViewModel[]
  className?: string
}

const headClass = cn(
  'h-11 px-4',
  enterpriseReadable.tableHeader,
)

const cellClass = 'px-4 py-3 align-middle'

export function SaleItemsTable({ items, className }: SaleItemsTableProps) {
  return (
    <Table className={cn('w-full table-fixed', className)}>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={cn(headClass, 'w-[42%] text-left')}>Item</TableHead>
          <TableHead className={cn(headClass, 'w-[14%] text-center')}>Qty</TableHead>
          <TableHead className={cn(headClass, 'w-[22%] text-right')}>Price</TableHead>
          <TableHead className={cn(headClass, 'w-[22%] text-right')}>Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id} className="min-h-16">
            <TableCell className={cellClass}>
              <div className="flex items-center gap-3">
                <ProductImage
                  product={{
                    id: item.productId,
                    name: item.productName,
                    image_url: item.imageUrl,
                  }}
                  className="h-11 w-11 shrink-0 rounded-lg"
                />
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
              {formatSaleItemQty(item.qty)}
            </TableCell>
            <TableCell
              className={cn(
                cellClass,
                enterpriseReadable.unitPrice,
                'text-right whitespace-nowrap',
              )}
            >
              {formatSaleItemMoney(item.unitPrice)}
            </TableCell>
            <TableCell
              className={cn(
                cellClass,
                enterpriseReadable.lineTotal,
                'text-right whitespace-nowrap',
              )}
            >
              {formatSaleItemMoney(item.lineTotal)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
