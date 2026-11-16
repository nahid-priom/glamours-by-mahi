import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { AppImage } from '@/components/common/AppImage'
import { StockStatusBadge } from '@/features/inventory/components/StockStatusBadge'
import { formatNumber } from '@/lib/format'
import { formatVariantCountLabel } from '../lib/product-list-model'
import type { ProductInventoryViewModel } from '../lib/product-list-model'
import { ProductActionsMenu } from './ProductActionsMenu'
import { ProductCombinedStatusBadge } from './ProductCombinedStatusBadge'
import type { ProductListItem } from '../repositories/catalog.repository'

type Props = {
  item: ProductInventoryViewModel
  showCategoryBadge?: boolean
  onEdit: (product: ProductListItem) => void
  onDuplicate: (product: ProductListItem) => void
  onPrintBarcode: (product: ProductListItem) => void
  onDelete: (product: ProductListItem) => void
}

export function ProductInventoryCard({
  item,
  showCategoryBadge = false,
  onEdit: _onEdit,
  onDuplicate,
  onPrintBarcode,
  onDelete,
}: Props) {
  void _onEdit

  return (
    <article className="rounded-xl border border-border bg-white p-3 shadow-sm">
      <div className="flex gap-3">
        <AppImage
          src={item.coverUrl}
          alt={item.name}
          className="h-16 w-16 shrink-0 rounded-lg"
          aspectRatio="square"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link
              to={`/products/${item.id}/edit`}
              className="line-clamp-2 text-sm font-semibold text-[#111111] hover:underline"
            >
              {item.name}
            </Link>
            <ProductCombinedStatusBadge
              lifecycleStatus={item.lifecycleStatus}
              stockStatus={item.stockStatus}
              className="shrink-0"
            />
          </div>
          <p className="truncate text-xs text-[#6B7280]">{item.sku ?? '—'}</p>
          {showCategoryBadge ? (
            <div className="mt-1 flex flex-wrap gap-1">
              <Badge variant="default" className="text-[10px]">
                {item.categoryName}
              </Badge>
            </div>
          ) : null}
          {item.brandName ? (
            <p className="truncate text-xs text-[#9CA3AF]">{item.brandName}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div className="min-w-0">
          <p className="text-xs text-[#9CA3AF]">Price</p>
          <p className="truncate tabular-nums font-medium text-[#111111]">{item.priceLabel}</p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-xs text-[#9CA3AF]">Available</p>
          <div className="flex items-center justify-end gap-1.5">
            <p className="tabular-nums font-medium text-[#111111]">
              {formatNumber(item.availableStock)} {item.unit}
            </p>
            <StockStatusBadge status={item.stockStatus} />
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-[#9CA3AF]">Variants</p>
          <p className="text-[#111111]">{formatVariantCountLabel(item.variantCount)}</p>
        </div>
      </div>

      <div className="mt-3">
        <ProductActionsMenu
          product={item.raw}
          onDuplicate={onDuplicate}
          onPrintBarcode={onPrintBarcode}
          onDelete={onDelete}
          compact
        />
      </div>
    </article>
  )
}

/** @deprecated Use ProductInventoryCard */
export const ProductMobileCard = ProductInventoryCard
