import { Link } from 'react-router-dom'
import type { SaleListRow } from '@/services/sales.service'
import { formatBDT } from '@/lib/format'
import { SaleStatusBadge } from './SaleStatusBadge'
import { Button } from '@/components/ui/button'
import type { SaleRowActions } from './SalesTable'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

interface SalesMobileCardsProps {
  rows: SaleListRow[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  actions: SaleRowActions
}

export function SalesMobileCards({ rows, selectedIds, onToggle, actions }: SalesMobileCardsProps) {
  return (
    <div className="space-y-3 md:hidden">
      {rows.map((row) => (
        <div
          key={row.id}
          className={cn(
            'rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm',
            row.deleted_at && 'opacity-50',
          )}
        >
          <div className="flex items-start gap-3">
            <Checkbox
              checked={selectedIds.has(row.id)}
              onCheckedChange={() => onToggle(row.id)}
              className="mt-1"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link to={`/sales/${row.id}`} className="font-semibold text-[#E11D48]">
                    Invoice {row.saleNo}
                  </Link>
                  <p className="mt-0.5 text-sm text-[#6B7280]">Customer: {row.customerName}</p>
                </div>
                <SaleStatusBadge status={row.status} />
              </div>
              <p className="mt-2 text-lg font-bold">{formatBDT(row.total)}</p>
              <p className="text-xs text-[#6B7280]">Paid: {formatBDT(row.paidAmount)}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => actions.onView(row.id)}>
                  View
                </Button>
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => actions.onPrint(row.id, 'a4')}>
                  Print
                </Button>
                {row.dueAmount > 0 && !row.deleted_at && (
                  <Button size="sm" className="rounded-full" onClick={() => actions.onPayment(row.id)}>
                    Payment
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
