import { formatNumber } from '@/lib/format'
import type { CategoryProductGroupModel } from '../lib/product-list-model'
import { CategoryCollapseButton } from './AvailableStockDetails'
import { ProductInventoryRow, ProductInventoryTableHeader } from './ProductInventoryRow'
import type { ProductListItem } from '../repositories/catalog.repository'

type Props = {
  group: CategoryProductGroupModel
  expanded: boolean
  onToggle: () => void
  onDuplicate: (product: ProductListItem) => void
  onPrintBarcode: (product: ProductListItem) => void
  onDelete: (product: ProductListItem) => void
}

export function CategoryProductGroup({
  group,
  expanded,
  onToggle,
  onDuplicate,
  onPrintBarcode,
  onDelete,
}: Props) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-slate-50/70 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <CategoryCollapseButton expanded={expanded} onToggle={onToggle} />
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-[#111111]">{group.categoryName}</h2>
            <p className="text-xs text-[#6B7280]">
              {formatNumber(group.productCount)} products · {formatNumber(group.totalAvailable)} available
            </p>
          </div>
        </div>
      </div>

      {expanded ? (
        group.products.length > 0 ? (
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[640px] table-fixed border-collapse">
              <colgroup>
                <col className="w-[34%]" />
                <col className="w-[20%]" />
                <col className="w-[18%]" />
                <col className="w-[12%]" />
                <col className="w-[16%]" />
              </colgroup>
              <ProductInventoryTableHeader />
              <tbody>
                {group.products.map((item) => (
                  <ProductInventoryRow
                    key={item.id}
                    item={item}
                    onEdit={() => {}}
                    onDuplicate={onDuplicate}
                    onPrintBarcode={onPrintBarcode}
                    onDelete={onDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-[#6B7280]">
            No products in this category on the current page.
          </p>
        )
      ) : null}
    </section>
  )
}
