import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { AppImage } from '@/components/common/AppImage'
import { formatVariantCountLabel } from '../lib/product-list-model'
import type { ProductInventoryViewModel } from '../lib/product-list-model'
import { AvailableStockDetails } from './AvailableStockDetails'
import { ProductActionsMenu } from './ProductActionsMenu'
import { ProductCombinedStatusBadge } from './ProductCombinedStatusBadge'
import { ProductVariantExpandRow } from './ProductVariantExpandRow'
import type { ProductListItem } from '../repositories/catalog.repository'
import { Fragment } from 'react'

type Props = {
  item: ProductInventoryViewModel
  showCategoryBadge?: boolean
  selected?: boolean
  expanded?: boolean
  onToggleSelect?: (productId: string) => void
  onToggleExpand?: (productId: string) => void
  onEdit: (product: ProductListItem) => void
  onDuplicate: (product: ProductListItem) => void
  onPrintBarcode: (product: ProductListItem) => void
  onDelete: (product: ProductListItem) => void
}

export function ProductInventoryRow({
  item,
  showCategoryBadge = false,
  selected,
  expanded,
  onToggleSelect,
  onToggleExpand,
  onEdit: _onEdit,
  onDuplicate,
  onPrintBarcode,
  onDelete,
}: Props) {
  void _onEdit

  return (
    <Fragment>
      <tr className="border-b border-border last:border-b-0">
        <td className="px-3 py-3 align-middle">
          <div className="flex min-w-0 items-center gap-2">
            {onToggleSelect ? (
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border"
                checked={Boolean(selected)}
                onChange={() => onToggleSelect(item.id)}
                aria-label={`Select ${item.name}`}
              />
            ) : null}
            <button
              type="button"
              className="rounded p-0.5 text-[#6B7280] hover:bg-slate-100"
              onClick={() => onToggleExpand?.(item.id)}
              aria-label={expanded ? 'Collapse variants' : 'Expand variants'}
            >
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            <AppImage
              src={item.coverUrl}
              alt={item.name}
              className="h-11 w-11 shrink-0 rounded-lg"
              aspectRatio="square"
            />
            <div className="min-w-0">
              <Link
                to={`/products/${item.id}/edit`}
                className="line-clamp-2 text-sm font-medium text-[#111111] hover:underline"
              >
                {item.name}
              </Link>
              <p className="truncate text-xs text-[#9CA3AF]">
                {[item.brandName, item.sku].filter(Boolean).join(' · ') || '—'}
              </p>
              {showCategoryBadge ? (
                <Badge variant="default" className="mt-1 text-[10px] font-normal">
                  {item.categoryName}
                </Badge>
              ) : null}
            </div>
          </div>
        </td>
        <td className="px-3 py-3 align-middle">
          <button
            type="button"
            className="text-left text-sm text-[#E11D48] hover:underline"
            onClick={() => onToggleExpand?.(item.id)}
          >
            {formatVariantCountLabel(item.variantCount)}
          </button>
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
            onDuplicate={onDuplicate}
            onPrintBarcode={onPrintBarcode}
            onDelete={onDelete}
          />
        </td>
      </tr>
      {expanded ? <ProductVariantExpandRow product={item.raw} /> : null}
    </Fragment>
  )
}

export function ProductInventoryTableHeader({
  showCategory = false,
  allSelected,
  onToggleAll,
}: {
  showCategory?: boolean
  allSelected?: boolean
  onToggleAll?: () => void
}) {
  return (
    <thead className="bg-slate-50/80">
      <tr className="text-left text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
        <th className="px-3 py-2.5">
          <div className="flex items-center gap-2">
            {onToggleAll ? (
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border"
                checked={Boolean(allSelected)}
                onChange={onToggleAll}
                aria-label="Select all products"
              />
            ) : null}
            Product{showCategory ? '' : ''}
          </div>
        </th>
        <th className="px-3 py-2.5">Variants &amp; Price</th>
        <th className="px-3 py-2.5 text-right">Available Stock</th>
        <th className="px-3 py-2.5">Status</th>
        <th className="px-3 py-2.5 text-right">Actions</th>
      </tr>
    </thead>
  )
}
