import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { ProductInventoryViewModel } from '../lib/product-list-model'
import { ProductInventoryCard } from './ProductInventoryCard'
import { ProductInventoryRow, ProductInventoryTableHeader } from './ProductInventoryRow'
import type { ProductListItem } from '../repositories/catalog.repository'

type Props = {
  items: ProductInventoryViewModel[]
  showCategoryBadge?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (productId: string) => void
  onToggleSelectAll?: () => void
  onEdit: (product: ProductListItem) => void
  onDuplicate: (product: ProductListItem) => void
  onPrintBarcode: (product: ProductListItem) => void
  onDelete: (product: ProductListItem) => void
  className?: string
}

export function ProductListPanel({
  items,
  showCategoryBadge = false,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onEdit,
  onDuplicate,
  onPrintBarcode,
  onDelete,
  className,
}: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allSelected = Boolean(selectedIds && items.length > 0 && items.every((i) => selectedIds.has(i.id)))

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
              <col className="w-[36%]" />
              <col className="w-[20%]" />
              <col className="w-[18%]" />
              <col className="w-[14%]" />
              <col className="w-[12%]" />
            </colgroup>
            <ProductInventoryTableHeader
              showCategory={showCategoryBadge}
              allSelected={allSelected}
              onToggleAll={onToggleSelectAll}
            />
            <tbody>
              {items.map((item) => (
                <ProductInventoryRow
                  key={item.id}
                  item={item}
                  showCategoryBadge={showCategoryBadge}
                  selected={selectedIds?.has(item.id)}
                  expanded={expandedIds.has(item.id)}
                  onToggleSelect={onToggleSelect}
                  onToggleExpand={toggleExpand}
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
