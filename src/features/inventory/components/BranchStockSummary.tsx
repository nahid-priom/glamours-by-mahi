import { Building2, Crown } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { InventoryBranchSummaryRow } from '../repositories/inventory-valuation.repository'
import { MoneyValue } from './InventoryValuationUi'
import { StockStatusBadge } from './StockStatusBadge'

type BranchStockSummaryProps = {
  rows: InventoryBranchSummaryRow[]
  canViewCost: boolean
  selectedBranchId: string | null
  onSelectBranch: (branchId: string | null) => void
  orgPurchaseCost?: number | null
}

export function BranchStockSummary({
  rows,
  canViewCost,
  selectedBranchId,
  onSelectBranch,
  orgPurchaseCost,
}: BranchStockSummaryProps) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-white p-6 text-center text-sm text-[#6B7280]">
        No branch stock data for your access level.
      </p>
    )
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-white md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Branch</TableHead>
              <TableHead className="text-right">Products</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              {canViewCost ? <TableHead className="text-right">Purchase cost</TableHead> : null}
              <TableHead className="text-right">Selling value</TableHead>
              {canViewCost ? <TableHead className="text-right">Profit</TableHead> : null}
              <TableHead className="text-right">Low / Out</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const share =
                canViewCost &&
                orgPurchaseCost &&
                orgPurchaseCost > 0 &&
                row.total_stock_purchase_cost != null
                  ? Math.round((row.total_stock_purchase_cost / orgPurchaseCost) * 100)
                  : null
              return (
                <TableRow
                  key={row.branch_id}
                  className={cn(selectedBranchId === row.branch_id && 'bg-[#FFF9FB]')}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {row.is_head_office ? (
                        <Crown className="h-4 w-4 text-[#FF3F7F]" aria-label="Head office" />
                      ) : (
                        <Building2 className="h-4 w-4 text-[#9CA3AF]" aria-hidden />
                      )}
                      <div>
                        <p className="font-medium">{row.branch_name}</p>
                        <p className="text-xs text-[#9CA3AF]">
                          {row.branch_code ?? '—'}
                          {row.is_head_office ? ' · Head Office' : ''}
                          {share != null ? ` · ${share}% of cost` : ''}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{row.total_products}</TableCell>
                  <TableCell className="text-right font-medium">
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
                  <TableCell className="text-right text-xs text-[#6B7280]">
                    {row.low_stock_count} / {row.out_of_stock_count}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSelectBranch(row.branch_id)}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="grid gap-3 md:hidden">
        {rows.map((row) => (
          <button
            key={row.branch_id}
            type="button"
            onClick={() => onSelectBranch(row.branch_id)}
            className={cn(
              'rounded-xl border border-border bg-white p-4 text-left shadow-sm transition hover:border-[#FF3F7F]/40',
              selectedBranchId === row.branch_id && 'ring-2 ring-[#FF3F7F]/30',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-[#111827]">{row.branch_name}</p>
                <p className="text-xs text-[#6B7280]">
                  {row.is_head_office ? 'Head Office' : 'Branch'}
                  {row.branch_code ? ` · ${row.branch_code}` : ''}
                </p>
              </div>
              {row.is_head_office ? (
                <span className="rounded-full bg-[#FFF1F6] px-2 py-0.5 text-[10px] font-semibold text-[#FF3F7F]">
                  HO
                </span>
              ) : null}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-[10px] uppercase text-[#9CA3AF]">Qty</p>
                <p className="font-semibold">{row.total_stock_quantity.toLocaleString('en-BD')}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-[#9CA3AF]">Selling value</p>
                <p className="font-semibold">
                  <MoneyValue amount={row.total_stock_value} />
                </p>
              </div>
              {canViewCost ? (
                <>
                  <div>
                    <p className="text-[10px] uppercase text-[#9CA3AF]">Purchase cost</p>
                    <p className="font-semibold">
                      <MoneyValue amount={row.total_stock_purchase_cost} />
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-[#9CA3AF]">Profit</p>
                    <p className="font-semibold">
                      <MoneyValue amount={row.potential_gross_profit} />
                    </p>
                  </div>
                </>
              ) : null}
            </div>
            <div className="mt-2 flex gap-2">
              <StockStatusBadge status="low_stock" />
              <span className="text-xs text-[#6B7280]">{row.low_stock_count} low</span>
              <span className="text-xs text-[#6B7280]">{row.out_of_stock_count} out</span>
            </div>
          </button>
        ))}
      </div>
    </>
  )
}
