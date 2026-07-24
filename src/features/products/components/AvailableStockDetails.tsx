import { ChevronDown, ChevronRight, Info } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { StockStatusBadge } from '@/features/inventory/components/StockStatusBadge'
import type { ProductInventoryViewModel } from '../lib/product-list-model'

type Props = {
  item: ProductInventoryViewModel
  className?: string
}

export function AvailableStockDetails({ item, className }: Props) {
  const showBreakdown = item.reserved > 0 || item.onHand !== item.availableStock

  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      <div className="min-w-0 text-right">
        <p className="tabular-nums text-sm font-semibold text-[#111111]">
          {formatNumber(item.availableStock)} {item.unit}
        </p>
      </div>
      <StockStatusBadge status={item.stockStatus} className="shrink-0" />
      {showBreakdown ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#9CA3AF] hover:bg-slate-100 hover:text-[#6B7280]"
              aria-label="View stock breakdown"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 p-3 text-xs">
            <p className="mb-2 font-semibold text-[#111111]">Stock breakdown</p>
            <dl className="space-y-1.5 text-[#6B7280]">
              <div className="flex items-center justify-between gap-3">
                <dt>On hand</dt>
                <dd className="tabular-nums font-medium text-[#111111]">
                  {formatNumber(item.onHand)}
                </dd>
              </div>
              {item.reserved > 0 ? (
                <div className="flex items-center justify-between gap-3">
                  <dt>Reserved</dt>
                  <dd className="tabular-nums font-medium text-[#111111]">
                    {formatNumber(item.reserved)}
                  </dd>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-3">
                <dt>Available</dt>
                <dd className="tabular-nums font-medium text-[#111111]">
                  {formatNumber(item.availableStock)}
                </dd>
              </div>
            </dl>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
}

export function CategoryCollapseButton({
  expanded,
  onToggle,
  className,
}: {
  expanded: boolean
  onToggle: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md text-[#6B7280] hover:bg-slate-100',
        className,
      )}
      aria-expanded={expanded}
      aria-label={expanded ? 'Collapse category' : 'Expand category'}
    >
      {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
    </button>
  )
}
