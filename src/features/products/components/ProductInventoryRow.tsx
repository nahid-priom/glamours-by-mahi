import { AppImage } from '@/components/common/AppImage'
import { formatVariantCountLabel } from '../lib/product-list-model'
import type { ProductInventoryViewModel } from '../lib/product-list-model'
import { AvailableStockDetails } from './AvailableStockDetails'
import { ProductActionsMenu } from './ProductActionsMenu'
import { ProductCombinedStatusBadge } from './ProductCombinedStatusBadge'
import type { ProductListItem } from '../repositories/catalog.repository'

type Props = {
  item: ProductInventoryViewModel
  onEdit: (product: ProductListItem) => void
  onDuplicate: (product: ProductListItem) => void
  onPrintBarcode: (product: ProductListItem) => void
  onDelete: (product: ProductListItem) => void
}

export function ProductInventoryRow({
  item,
  onEdit,
  onDuplicate,
  onPrintBarcode,
  onDelete,
}: Props) {
  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="px-3 py-3 align-middle">
        <div className="flex min-w-0 items-center gap-3">
          <AppImage
            src={item.coverUrl}
            alt={item.name}
            className="h-11 w-11 shrink-0 rounded-lg"
            aspectRatio="square"
          />
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm font-medium text-[#111111]">{item.name}</p>
            <p className="truncate text-xs text-[#9CA3AF]">{item.sku ?? '—'}</p>
            {item.brandName ? (
              <p className="truncate text-[11px] font-medium uppercase tracking-wide text-[#9CA3AF]">
                {item.brandName}
              </p>
            ) : null}
          </div>
        </div>
      </td>
      <td className="px-3 py-3 align-middle">
        <p className="text-sm text-[#111111]">{formatVariantCountLabel(item.variantCount)}</p>
        <p className="tabular-nums text-sm font-medium text-[#111111]">{item.priceLabel}</p>
      </td>
      <td className="px-3 py-3 align-middle">
        <AvailableStockDetails item={item} className="justify-end" />
      </td>
      <td className="px-3 py-3 align-middle">
        <ProductCombinedStatusBadge
          lifecycleStatus={item.lifecycleStatus}
          stockStatus={item.stockStatus}
        />
      </td>
      <td className="px-3 py-3 align-middle">
        <ProductActionsMenu
          product={item.raw}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onPrintBarcode={onPrintBarcode}
          onDelete={onDelete}
        />
      </td>
    </tr>
  )
}

export function ProductInventoryTableHeader() {
  return (
    <thead className="bg-slate-50/80">
      <tr className="text-left text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
        <th className="px-3 py-2.5">Product</th>
        <th className="px-3 py-2.5">Variants &amp; Price</th>
        <th className="px-3 py-2.5 text-right">Available Stock</th>
        <th className="px-3 py-2.5">Status</th>
        <th className="px-3 py-2.5 text-right">Actions</th>
      </tr>
    </thead>
  )
}
