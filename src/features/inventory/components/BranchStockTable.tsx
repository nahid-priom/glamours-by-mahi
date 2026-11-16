import { Building2, Crown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { InventoryBranchSummaryRow } from '../repositories/inventory-valuation.repository'
import { MoneyValue } from './InventoryValuationUi'
import { StockStatusBadge } from './StockStatusBadge'

type Props = {
  rows: InventoryBranchSummaryRow[]
  canViewCost: boolean
  selectedBranchId: string | null
  onViewStock: (branchId: string) => void
  onViewSupplierStock?: (branchId: string) => void
}

export function BranchStockTable({
  rows,
  canViewCost,
  selectedBranchId,
  onViewStock,
  onViewSupplierStock,
}: Props) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-white p-6 text-center text-sm text-[#6B7280]">
        No branch stock data for your access level.
      </p>
    )
  }

  const totals = rows.reduce(
    (acc, row) => ({
      qty: acc.qty + row.total_stock_quantity,
      cost: acc.cost + (row.total_stock_purchase_cost ?? 0),
      value: acc.value + row.total_stock_value,
      profit: acc.profit + (row.potential_gross_profit ?? 0),
      low: acc.low + row.low_stock_count,
      out: acc.out + row.out_of_stock_count,
    }),
    { qty: 0, cost: 0, value: 0, profit: 0, low: 0, out: 0 },
  )

  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-white md:block">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-slate-50">
            <TableRow>
              <TableHead>Branch</TableHead>
              <TableHead className="text-right">Branch products</TableHead>
              <TableHead className="text-right">Branch variants</TableHead>
              <TableHead className="text-right">Stock Qty</TableHead>
              {canViewCost ? <TableHead className="text-right">Stock Cost</TableHead> : null}
              <TableHead className="text-right">Selling Value</TableHead>
              {canViewCost ? <TableHead className="text-right">Potential Profit</TableHead> : null}
              <TableHead className="text-right">Low / Out</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.branch_id}
                className={cn(selectedBranchId === row.branch_id && 'bg-slate-50')}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    {row.is_head_office ? (
                      <Crown className="h-4 w-4 text-[#111827]" aria-label="Head office" />
                    ) : (
                      <Building2 className="h-4 w-4 text-[#9CA3AF]" aria-hidden />
                    )}
                    <div>
                      <p className="font-medium text-[#111827]">{row.branch_name}</p>
                      <p className="text-xs text-[#6B7280]">
                        {row.branch_code ?? '—'}
                        {row.is_head_office ? ' · Head Office' : ' · Retail branch'}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.total_products}</TableCell>
                <TableCell className="text-right tabular-nums">{row.total_variants}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {row.total_stock_quantity.toLocaleString('en-BD')}
                </TableCell>
                {canViewCost ? (
                  <TableCell className="text-right">
                    <MoneyValue amount={row.total_stock_purchase_cost} />
                  </TableCell>
                ) : null}
                <TableCell className="text-right">
                  <MoneyValue amount={row.total_stock_value} />
                </TableCell>
                {canViewCost ? (
                  <TableCell className="text-right">
                    <MoneyValue amount={row.potential_gross_profit} />
                  </TableCell>
                ) : null}
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1.5">
                    <StockStatusBadge status="low_stock" className="!px-2 !py-0" />
                    <span className="text-xs tabular-nums text-[#6B7280]">{row.low_stock_count}</span>
                    <StockStatusBadge status="out_of_stock" className="!px-2 !py-0" />
                    <span className="text-xs tabular-nums text-[#6B7280]">{row.out_of_stock_count}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="outline" onClick={() => onViewStock(row.branch_id)}>
                      View Stock
                    </Button>
                    {onViewSupplierStock ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onViewSupplierStock(row.branch_id)}
                      >
                        Suppliers
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-slate-50 font-medium">
              <TableCell>
                Grand totals
                <span className="mt-0.5 block text-[10px] font-normal text-[#9CA3AF]">
                  Qty / value / low / out only — product counts are per-branch listings
                </span>
              </TableCell>
              <TableCell className="text-right text-xs text-[#9CA3AF]">—</TableCell>
              <TableCell className="text-right text-xs text-[#9CA3AF]">—</TableCell>
              <TableCell className="text-right tabular-nums">{totals.qty.toLocaleString('en-BD')}</TableCell>
              {canViewCost ? (
                <TableCell className="text-right">
                  <MoneyValue amount={totals.cost} />
                </TableCell>
              ) : null}
              <TableCell className="text-right">
                <MoneyValue amount={totals.value} />
              </TableCell>
              {canViewCost ? (
                <TableCell className="text-right">
                  <MoneyValue amount={totals.profit} />
                </TableCell>
              ) : null}
              <TableCell className="text-right text-xs text-[#6B7280]">
                Low: {totals.low} · Out: {totals.out}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 md:hidden">
        {rows.map((row) => (
          <article
            key={row.branch_id}
            className={cn(
              'rounded-xl border border-border bg-white p-4',
              selectedBranchId === row.branch_id && 'ring-2 ring-[#111827]/10',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-[#111827]">{row.branch_name}</p>
                <p className="text-xs text-[#6B7280]">{row.branch_code ?? '—'}</p>
              </div>
              {row.is_head_office ? <Crown className="h-4 w-4 text-[#111827]" /> : null}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-[#9CA3AF]">Stock Qty</p>
                <p className="tabular-nums font-semibold">{row.total_stock_quantity.toLocaleString('en-BD')}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[#9CA3AF]">Selling Value</p>
                <MoneyValue amount={row.total_stock_value} className="font-semibold" />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-xs text-[#6B7280]">
                Low: {row.low_stock_count} · Out: {row.out_of_stock_count}
              </p>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => onViewStock(row.branch_id)}>
                  View Stock
                </Button>
                {onViewSupplierStock ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onViewSupplierStock(row.branch_id)}
                  >
                    Suppliers
                  </Button>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  )
}
