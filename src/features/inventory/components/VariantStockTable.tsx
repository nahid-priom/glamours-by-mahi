import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { BranchStockRow } from '../repositories/inventory.repository'
import { resolveAvailableStockStatus, resolveLocationStockStatus } from '../lib/stock-status'
import { StockStatusBadge } from './StockStatusBadge'

type Props = {
  rows: BranchStockRow[]
  isLoading?: boolean
}

function variantLabel(name: string | null) {
  if (!name?.trim()) return 'Default'
  return name.replace(/\s*\/\s*/g, ' / ')
}

export function VariantStockTable({ rows, isLoading }: Props) {
  if (!isLoading && rows.length === 0) return null

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-white">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-slate-50">
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Variant</TableHead>
            <TableHead>SKU / Barcode</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead className="text-right">Available</TableHead>
            <TableHead className="text-right">Reorder</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Stock Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const available = row.available ?? Math.max(row.quantity - (row.qtyReserved ?? 0), 0)
            const status =
              resolveLocationStockStatus(row.locationType, available) ??
              resolveAvailableStockStatus(available, row.reorderLevel)
            return (
              <TableRow key={row.balanceId}>
                <TableCell className="font-medium">{row.productName}</TableCell>
                <TableCell>{variantLabel(row.variantName)}</TableCell>
                <TableCell className="text-sm text-[#6B7280]">
                  {row.sku}
                  {row.barcode ? ` · ${row.barcode}` : ''}
                </TableCell>
                <TableCell className="text-sm text-[#6B7280]">{row.branchName}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{available}</TableCell>
                <TableCell className="text-right tabular-nums">{row.reorderLevel}</TableCell>
                <TableCell className="text-sm capitalize text-[#6B7280]">{row.locationName}</TableCell>
                <TableCell>
                  <StockStatusBadge status={status} />
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild size="sm" variant="ghost">
                    <Link to="/inventory/adjustments">Adjust</Link>
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      {isLoading ? <p className="p-4 text-center text-sm text-[#6B7280]">Loading variants…</p> : null}
    </div>
  )
}
