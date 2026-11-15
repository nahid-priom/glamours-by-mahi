import { Link } from 'react-router-dom'
import { ArrowLeftRight, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { LowStockRow } from '../repositories/inventory.repository'
import { resolveAvailableStockStatus } from '../lib/stock-status'
import { StockStatusBadge } from './StockStatusBadge'

type Props = {
  rows: LowStockRow[]
  isLoading?: boolean
}

export function LowStockTable({ rows, isLoading }: Props) {
  if (!isLoading && rows.length === 0) return null

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-white">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-slate-50">
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Variant</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead className="text-right">Current Stock</TableHead>
            <TableHead className="text-right">Reorder Level</TableHead>
            <TableHead className="text-right">Shortage</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const available = row.available ?? Math.max(row.quantity - (row.qtyReserved ?? 0), 0)
            const status = resolveAvailableStockStatus(available, row.reorderLevel)
            return (
              <TableRow key={row.balanceId}>
                <TableCell className="font-medium">{row.productName}</TableCell>
                <TableCell>{row.variantName ?? 'Default'}</TableCell>
                <TableCell className="text-sm text-[#6B7280]">{row.branchName}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{available}</TableCell>
                <TableCell className="text-right tabular-nums">{row.reorderLevel}</TableCell>
                <TableCell className="text-right tabular-nums text-[#DC2626]">{row.shortage}</TableCell>
                <TableCell>
                  <StockStatusBadge status={status} />
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <PermissionGate permission="inventory.adjust">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/inventory/adjustments">
                          <SlidersHorizontal className="mr-1 h-3.5 w-3.5" />
                          Adjust
                        </Link>
                      </Button>
                    </PermissionGate>
                    <PermissionGate permission="inventory.transfer">
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/inventory/transfers/new">
                          <ArrowLeftRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </PermissionGate>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      {isLoading ? <p className="p-4 text-center text-sm text-[#6B7280]">Loading low stock…</p> : null}
    </div>
  )
}
