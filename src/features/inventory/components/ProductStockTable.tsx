import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { InventoryProductStockRow } from '../repositories/inventory-valuation.repository'
import { MoneyValue, QuantityValue } from './InventoryValuationUi'
import { StockStatusBadge } from './StockStatusBadge'

type Props = {
  rows: InventoryProductStockRow[]
  canViewCost: boolean
  isLoading?: boolean
  onViewDetails: (row: InventoryProductStockRow) => void
}

export function ProductStockTable({ rows, canViewCost, isLoading, onViewDetails }: Props) {
  if (!isLoading && rows.length === 0) return null

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-white">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-slate-50">
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Branches</TableHead>
            <TableHead className="text-right">Variants</TableHead>
            <TableHead className="text-right">Available</TableHead>
            <TableHead className="text-right">Reserved</TableHead>
            {canViewCost ? <TableHead className="text-right">Stock Cost</TableHead> : null}
            <TableHead className="text-right">Selling Value</TableHead>
            <TableHead>Stock Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.product_id}>
              <TableCell>
                <div className="min-w-[180px]">
                  <p className="line-clamp-2 font-medium text-[#111827]">{row.product_name}</p>
                  {row.brand ? <p className="text-xs text-[#9CA3AF]">{row.brand}</p> : null}
                </div>
              </TableCell>
              <TableCell className="text-sm text-[#6B7280]">{row.product_code ?? '—'}</TableCell>
              <TableCell className="text-sm text-[#6B7280]">{row.category ?? '—'}</TableCell>
              <TableCell className="text-right tabular-nums">{row.branch_count}</TableCell>
              <TableCell className="text-right tabular-nums">{row.variant_count}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                <QuantityValue qty={row.available_quantity} />
              </TableCell>
              <TableCell className="text-right tabular-nums text-[#6B7280]">
                {row.reserved_quantity}
              </TableCell>
              {canViewCost ? (
                <TableCell className="text-right">
                  <MoneyValue amount={row.total_purchase_cost} />
                </TableCell>
              ) : null}
              <TableCell className="text-right">
                <MoneyValue amount={row.total_stock_value} />
              </TableCell>
              <TableCell>
                <StockStatusBadge status={row.stock_status} />
              </TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="outline" onClick={() => onViewDetails(row)}>
                  View Details
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {isLoading ? (
        <p className="p-4 text-center text-sm text-[#6B7280]">Loading stock…</p>
      ) : null}
    </div>
  )
}
