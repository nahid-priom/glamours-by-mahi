import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { InventoryVariantStockRow } from '../repositories/inventory-valuation.repository'
import { StockStatusBadge } from './StockStatusBadge'

type Props = {
  rows: InventoryVariantStockRow[]
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
            <TableHead className="text-right">On hand</TableHead>
            <TableHead className="text-right">Available</TableHead>
            <TableHead className="text-right">Reorder</TableHead>
            <TableHead>Stock Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.row_key}>
              <TableCell className="font-medium">{row.product_name}</TableCell>
              <TableCell>{variantLabel(row.variant_name)}</TableCell>
              <TableCell className="text-sm text-[#6B7280]">
                {row.sku}
                {row.barcode ? ` · ${row.barcode}` : ''}
              </TableCell>
              <TableCell className="text-sm text-[#6B7280]">{row.branch_name}</TableCell>
              <TableCell className="text-right tabular-nums">{row.on_hand}</TableCell>
              <TableCell className="text-right tabular-nums font-medium">
                {row.available_quantity}
              </TableCell>
              <TableCell className="text-right tabular-nums">{row.reorder_level}</TableCell>
              <TableCell>
                <StockStatusBadge status={row.stock_status} />
              </TableCell>
              <TableCell className="text-right">
                <Button asChild size="sm" variant="ghost">
                  <Link to="/inventory/adjustments">Adjust</Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {isLoading ? <p className="p-4 text-center text-sm text-[#6B7280]">Loading variants…</p> : null}
    </div>
  )
}
