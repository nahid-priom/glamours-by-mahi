import { useNavigate } from 'react-router-dom'
import { Eye } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatBDT, formatInvoiceDateTime } from '@/lib/format'
import { formatCategoryChips } from '../schemas/sale-filters.schema'
import type { SalesHistoryRow } from '../types/sale.types'
import { paymentBadge } from './sale-status'
import { SalesRowActions } from './SalesRowActions'

export function SalesHistoryMobileCards({ rows }: { rows: SalesHistoryRow[] }) {
  const navigate = useNavigate()

  return (
    <div className="space-y-2 md:hidden">
      {rows.map((row) => {
        const badge = paymentBadge(row)
        return (
          <article
            key={row.id}
            className="rounded-2xl border border-border bg-white p-3 shadow-sm"
          >
            <button
              type="button"
              className="flex w-full items-start justify-between gap-2 text-left"
              onClick={() => navigate(`/sales/${row.id}`)}
            >
              <div className="min-w-0">
                <p className="font-semibold text-text-primary">{row.invoice_no}</p>
                <p className="text-xs text-text-muted">{formatInvoiceDateTime(row.sale_at)}</p>
              </div>
              <Badge variant={badge.variant}>{badge.label}</Badge>
            </button>

            <div className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-text-muted">Customer</span>
                <span className="font-medium">{row.customer_name ?? 'Walk-in Customer'}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-text-muted">Items</span>
                <span className="max-w-[60%] truncate text-right">
                  {row.item_qty.toLocaleString('en-US')} · {formatCategoryChips(row.category_summary, 2)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-text-muted">Total</span>
                <span className="font-bold tabular-nums">{formatBDT(row.grand_total)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-text-muted">Paid</span>
                <span className="font-medium tabular-nums text-success">
                  {formatBDT(row.paid_total)}
                </span>
              </div>
              {row.due_total > 0 ? (
                <div className="flex justify-between gap-2">
                  <span className="text-text-muted">Due</span>
                  <span className="font-semibold tabular-nums text-danger">
                    {formatBDT(row.due_total)}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="mt-3 flex items-center gap-2 border-t border-border pt-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => navigate(`/sales/${row.id}`)}
              >
                <Eye className="h-3.5 w-3.5" />
                View
              </Button>
              <SalesRowActions sale={row} />
            </div>
          </article>
        )
      })}
    </div>
  )
}
