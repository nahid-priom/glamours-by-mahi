import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { InventoryProductStockRow } from '../repositories/inventory-valuation.repository'
import { MoneyValue, QuantityValue } from './InventoryValuationUi'
import { StockStatusBadge } from './StockStatusBadge'

type Props = {
  row: InventoryProductStockRow | null
  open: boolean
  canViewCost: boolean
  onOpenChange: (open: boolean) => void
}

function DetailTile({
  label,
  value,
  className,
  valueClassName,
}: {
  label: string
  value: ReactNode
  className?: string
  valueClassName?: string
}) {
  return (
    <div className={cn('min-w-0 rounded-xl border border-[#FECDD3] bg-white px-3 py-2.5', className)}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6B7280]">{label}</p>
      <div className={cn('mt-1 truncate text-sm font-semibold tabular-nums text-[#111827]', valueClassName)}>
        {value}
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#111827]">{children}</p>
  )
}

export function StockDetailsDrawer({ row, open, canViewCost, onOpenChange }: Props) {
  if (!row) return null

  const subline = [row.brand, row.category].filter(Boolean).join(' · ')

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-hidden p-0 sm:max-w-md"
      >
        <div className="flex h-full min-h-0 flex-col">
          <SheetHeader className="shrink-0 space-y-2 border-b border-[#FECDD3] bg-[#FFF1F2] p-5 pr-12">
            <div className="flex flex-wrap items-start gap-2">
              <SheetTitle className="min-w-0 flex-1 text-xl font-bold leading-snug text-[#111827]">
                {row.product_name}
              </SheetTitle>
              <StockStatusBadge status={row.stock_status} className="mt-0.5 shrink-0" />
            </div>
            {subline || row.product_code ? (
              <div className="space-y-0.5 text-sm text-[#6B7280]">
                {subline ? <p>{subline}</p> : null}
                {row.product_code ? (
                  <p className="font-mono text-xs text-[#111827]">{row.product_code}</p>
                ) : null}
              </div>
            ) : null}
          </SheetHeader>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
            <section className="space-y-2.5">
              <SectionLabel>Stock</SectionLabel>
              <DetailTile
                label="Available"
                value={<QuantityValue qty={row.available_quantity} />}
                className="bg-[#FFF1F2]"
                valueClassName="text-2xl font-bold text-[#111827]"
              />
              <div className="grid grid-cols-3 gap-2">
                <DetailTile label="Reserved" value={row.reserved_quantity} />
                <DetailTile
                  label="On Hand"
                  value={<QuantityValue qty={row.total_quantity} />}
                />
                <DetailTile label="Reorder" value={row.reorder_level} />
              </div>
            </section>

            <section className="space-y-2.5">
              <SectionLabel>Valuation</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                <DetailTile
                  label="Selling Price"
                  value={<MoneyValue amount={row.effective_selling_price} />}
                />
                <DetailTile
                  label="Selling Value"
                  value={<MoneyValue amount={row.total_stock_value} />}
                />
                {canViewCost ? (
                  <>
                    <DetailTile
                      label="Unit Cost (WAC)"
                      value={<MoneyValue amount={row.average_unit_cost} />}
                    />
                    <DetailTile
                      label="Stock Cost"
                      value={<MoneyValue amount={row.total_purchase_cost} />}
                    />
                    <DetailTile
                      label="Potential Profit"
                      value={<MoneyValue amount={row.potential_profit} />}
                      className="col-span-2 bg-[#FFF1F2]"
                      valueClassName="text-base text-[#111827]"
                    />
                  </>
                ) : null}
              </div>
            </section>

            <section className="space-y-2.5">
              <SectionLabel>Details</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                <DetailTile label="Branches" value={row.branch_count} />
                <DetailTile label="Variants" value={row.variant_count} />
              </div>
              {row.last_stock_movement_at ? (
                <p className="text-xs text-[#9CA3AF]">
                  Last movement{' '}
                  <span className="text-[#6B7280]">
                    {new Date(row.last_stock_movement_at).toLocaleString('en-BD')}
                  </span>
                </p>
              ) : null}
            </section>
          </div>

          <div className="shrink-0 border-t border-[#FECDD3] bg-white p-4">
            <div className="flex gap-2">
              <Button
                asChild
                size="sm"
                className="h-10 flex-1 bg-[#E11D48] text-white hover:bg-[#BE123C]"
              >
                <Link to={`/products/${row.product_id}/edit`}>Edit Product</Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="h-10 flex-1">
                <Link to={`/inventory/ledger?productId=${row.product_id}`}>Stock History</Link>
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
