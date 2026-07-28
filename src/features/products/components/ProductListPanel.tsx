import { cn } from '@/lib/utils'
import type { ProductInventoryViewModel } from '../lib/product-list-model'
import { ProductInventoryCard } from './ProductInventoryCard'
import { ProductInventoryRow, ProductInventoryTableHeader } from './ProductInventoryRow'
import type { ProductListItem } from '../repositories/catalog.repository'

type Props = {
  items: ProductInventoryViewModel[]
  showCategoryBadge?: boolean
  onEdit: (product: ProductListItem) => void
  onDuplicate: (product: ProductListItem) => void
  onPrintBarcode: (product: ProductListItem) => void
  onDelete: (product: ProductListItem) => void
  className?: string
}

export function ProductListPanel({
  items,
  showCategoryBadge = false,
  onEdit,
  onDuplicate,
  onPrintBarcode,
  onDelete,
  className,
}: Props) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="space-y-3 lg:hidden">
        {items.map((item) => (
          <ProductInventoryCard
            key={item.id}
            item={item}
            showCategoryBadge={showCategoryBadge}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            onPrintBarcode={onPrintBarcode}
            onDelete={onDelete}
          />
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-border bg-white lg:block">
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-[720px] table-fixed border-collapse">
            <colgroup>
              <col className="w-[30%]" />
              <col className="w-[10%]" />
              <col className="w-[18%]" />
              <col className="w-[16%]" />
              <col className="w-[12%]" />
              <col className="w-[14%]" />
            </colgroup>
            <ProductInventoryTableHeader showCategory={showCategoryBadge} />
            <tbody>
              {items.map((item) => (
                <ProductInventoryRow
                  key={item.id}
                  item={item}
                  showCategoryBadge={showCategoryBadge}
                  onEdit={onEdit}
                  onDuplicate={onDuplicate}
                  onPrintBarcode={onPrintBarcode}
                  onDelete={onDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
