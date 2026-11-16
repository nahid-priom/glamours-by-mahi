import { Fragment, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { queryKeys } from '@/lib/query/keys'
import { cn } from '@/lib/utils'
import {
  getSupplierStockBreakdown,
  type SupplierStockSummaryRow,
} from '../repositories/inventory-supplier.repository'
import { MoneyValue, QuantityValue } from './InventoryValuationUi'

type Props = {
  rows: SupplierStockSummaryRow[]
  canViewCost: boolean
  isLoading?: boolean
  branchId?: string | null
  includeNonSaleable?: boolean
  onViewDetails: (row: SupplierStockSummaryRow) => void
}

export function SupplierStockTable({
  rows,
  canViewCost,
  isLoading,
  branchId,
  includeNonSaleable,
  onViewDetails,
}: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (!isLoading && rows.length === 0) return null

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-white">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-slate-50">
          <TableRow>
            <TableHead className="w-10" />
            <TableHead>Supplier</TableHead>
            <TableHead className="text-right">Products</TableHead>
            <TableHead className="text-right">Variants</TableHead>
            <TableHead className="text-right">Received</TableHead>
            <TableHead className="text-right">Remaining</TableHead>
            {canViewCost ? <TableHead className="text-right">Stock Cost</TableHead> : null}
            <TableHead className="text-right">Selling Value</TableHead>
            <TableHead className="text-right">Low / Out</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const key = row.supplier_key
            const open = expanded === key
            return (
              <Fragment key={key}>
                <TableRow className={cn(open && 'bg-[#FFF1F2]/40')}>
                  <TableCell>
                    <button
                      type="button"
                      className="rounded p-1 text-[#6B7280] hover:bg-slate-100"
                      onClick={() => setExpanded(open ? null : key)}
                      aria-label={open ? 'Collapse' : 'Expand'}
                    >
                      {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      className="text-left font-medium text-[#111827] hover:underline"
                      onClick={() => onViewDetails(row)}
                    >
                      {row.supplier_name}
                    </button>
                    {row.supplier_code ? (
                      <p className="text-xs text-[#6B7280]">{row.supplier_code}</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.product_count}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.variant_count}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <QuantityValue qty={row.received_qty} />
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    <QuantityValue qty={row.remaining_qty} />
                  </TableCell>
                  {canViewCost ? (
                    <TableCell className="text-right">
                      <MoneyValue amount={row.stock_cost} />
                    </TableCell>
                  ) : null}
                  <TableCell className="text-right">
                    <MoneyValue amount={row.selling_value} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm text-[#6B7280]">
                    {row.low_stock_count} / {row.out_of_stock_count}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => onViewDetails(row)}>
                      Details
                    </Button>
                  </TableCell>
                </TableRow>
                {open ? (
                  <TableRow className="bg-[#FFF1F2]/30">
                    <TableCell colSpan={canViewCost ? 10 : 9} className="px-4 py-3">
                      <SupplierExpandPanel
                        row={row}
                        branchId={branchId}
                        includeNonSaleable={includeNonSaleable}
                        canViewCost={canViewCost}
                      />
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            )
          })}
        </TableBody>
      </Table>
      {isLoading ? <p className="p-4 text-center text-sm text-[#6B7280]">Loading suppliers…</p> : null}
    </div>
  )
}

function SupplierExpandPanel({
  row,
  branchId,
  includeNonSaleable,
  canViewCost,
}: {
  row: SupplierStockSummaryRow
  branchId?: string | null
  includeNonSaleable?: boolean
  canViewCost: boolean
}) {
  const unknown = !row.supplier_id
  const q = useQuery({
    queryKey: queryKeys.inventorySupplierBreakdown({
      supplierId: row.supplier_id,
      unknown,
      branchId,
      includeNonSaleable,
    }),
    queryFn: () =>
      getSupplierStockBreakdown({
        supplierId: row.supplier_id,
        supplierUnknown: unknown,
        branchId,
        includeNonSaleable,
      }),
  })

  if (q.isLoading) {
    return <p className="text-sm text-[#6B7280]">Loading products…</p>
  }
  if (q.error) {
    return (
      <p className="text-sm text-[#DC2626]">
        {q.error instanceof Error ? q.error.message : 'Failed to load breakdown'}
      </p>
    )
  }

  const products = q.data?.items ?? []
  if (products.length === 0) {
    return <p className="text-sm text-[#6B7280]">No attributed product stock for this supplier.</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[#FECDD3] bg-white">
      <table className="min-w-full text-left text-xs">
        <thead className="bg-[#FFF1F2] text-[#111827]">
          <tr>
            <th className="px-3 py-2 font-semibold">Product</th>
            <th className="px-3 py-2 font-semibold">Category</th>
            <th className="px-3 py-2 font-semibold text-right">Variants</th>
            <th className="px-3 py-2 font-semibold text-right">Remaining</th>
            {canViewCost ? (
              <th className="px-3 py-2 font-semibold text-right">Stock Cost</th>
            ) : null}
            <th className="px-3 py-2 font-semibold text-right">Selling Value</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={String(p.product_id)} className="border-t border-border">
              <td className="px-3 py-2 font-medium text-[#111827]">{String(p.product_name)}</td>
              <td className="px-3 py-2 text-[#6B7280]">{String(p.category ?? '—')}</td>
              <td className="px-3 py-2 text-right tabular-nums">{Number(p.variant_count ?? 0)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{Number(p.remaining_qty ?? 0)}</td>
              {canViewCost ? (
                <td className="px-3 py-2 text-right">
                  <MoneyValue amount={p.stock_cost == null ? null : Number(p.stock_cost)} />
                </td>
              ) : null}
              <td className="px-3 py-2 text-right">
                <MoneyValue amount={Number(p.selling_value ?? 0)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
