import { Link } from 'react-router-dom'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import type { InventoryProductStockRow } from '../repositories/inventory-valuation.repository'
import { MoneyValue, QuantityValue } from './InventoryValuationUi'
import { StockStatusBadge } from './StockStatusBadge'

type Props = {
  row: InventoryProductStockRow | null
  open: boolean
  canViewCost: boolean
  onOpenChange: (open: boolean) => void
}

export function StockDetailsDrawer({ row, open, canViewCost, onOpenChange }: Props) {
  if (!row) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{row.product_name}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-[#9CA3AF]">SKU</p>
              <p className="font-medium">{row.product_code ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-[#9CA3AF]">Category</p>
              <p className="font-medium">{row.category ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-[#9CA3AF]">Available</p>
              <p className="font-medium tabular-nums">
                <QuantityValue qty={row.available_quantity} />
              </p>
            </div>
            <div>
              <p className="text-xs text-[#9CA3AF]">Reserved</p>
              <p className="font-medium tabular-nums">{row.reserved_quantity}</p>
            </div>
            <div>
              <p className="text-xs text-[#9CA3AF]">On Hand</p>
              <p className="font-medium tabular-nums">
                <QuantityValue qty={row.total_quantity} />
              </p>
            </div>
            <div>
              <p className="text-xs text-[#9CA3AF]">Reorder Level</p>
              <p className="font-medium tabular-nums">{row.reorder_level}</p>
            </div>
            {canViewCost ? (
              <>
                <div>
                  <p className="text-xs text-[#9CA3AF]">Unit Cost (WAC)</p>
                  <MoneyValue amount={row.average_unit_cost} className="font-medium" />
                </div>
                <div>
                  <p className="text-xs text-[#9CA3AF]">Stock Cost</p>
                  <MoneyValue amount={row.total_purchase_cost} className="font-medium" />
                </div>
              </>
            ) : null}
            <div>
              <p className="text-xs text-[#9CA3AF]">Selling Price</p>
              <MoneyValue amount={row.effective_selling_price} className="font-medium" />
            </div>
            <div>
              <p className="text-xs text-[#9CA3AF]">Selling Value</p>
              <MoneyValue amount={row.total_stock_value} className="font-medium" />
            </div>
            {canViewCost ? (
              <div>
                <p className="text-xs text-[#9CA3AF]">Potential Profit</p>
                <MoneyValue amount={row.potential_profit} className="font-medium" />
              </div>
            ) : null}
            <div>
              <p className="text-xs text-[#9CA3AF]">Branches</p>
              <p className="font-medium tabular-nums">{row.branch_count}</p>
            </div>
            <div>
              <p className="text-xs text-[#9CA3AF]">Variants</p>
              <p className="font-medium tabular-nums">{row.variant_count}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-[#9CA3AF]">Status</p>
            <StockStatusBadge status={row.stock_status} className="mt-1" />
          </div>
          {row.last_stock_movement_at ? (
            <div>
              <p className="text-xs text-[#9CA3AF]">Last Movement</p>
              <p className="text-sm">{new Date(row.last_stock_movement_at).toLocaleString('en-BD')}</p>
            </div>
          ) : null}
          <div className="flex gap-2 pt-2">
            <Button asChild size="sm" variant="outline" className="flex-1">
              <Link to={`/products/${row.product_id}/edit`}>Edit Product</Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="flex-1">
              <Link to="/inventory/ledger">Stock History</Link>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
