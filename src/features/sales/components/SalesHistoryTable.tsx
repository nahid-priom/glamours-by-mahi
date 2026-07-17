import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatBDT, formatInvoiceDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { formatCategoryChips } from '../schemas/sale-filters.schema'
import type { SalesColumnKey, SalesHistoryRow } from '../types/sale.types'
import { lifecycleNote, paymentBadge } from './sale-status'
import { SalesRowActions } from './SalesRowActions'

export function SalesHistoryTable({
  rows,
  visible,
}: {
  rows: SalesHistoryRow[]
  visible: SalesColumnKey[]
}) {
  const navigate = useNavigate()
  const show = (key: SalesColumnKey) => visible.includes(key)

  return (
    <div className="hidden overflow-x-auto rounded-2xl border border-border bg-white md:block">
      <Table className="min-w-[880px]">
        <TableHeader className="sticky top-0 z-10 bg-white">
          <TableRow className="hover:bg-transparent">
            <TableHead>Invoice</TableHead>
            {show('customer') ? <TableHead>Customer</TableHead> : null}
            {show('items') ? <TableHead className="text-right">Items</TableHead> : null}
            <TableHead className="text-right">Total</TableHead>
            {show('paid') ? <TableHead className="text-right">Paid</TableHead> : null}
            {show('due') ? <TableHead className="text-right">Due</TableHead> : null}
            <TableHead>Status</TableHead>
            <TableHead className="sticky right-0 bg-white text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const badge = paymentBadge(row)
            const note = lifecycleNote(row)
            return (
              <TableRow
                key={row.id}
                className={cn('cursor-pointer', row.status === 'voided' && 'bg-red-50/40')}
                onClick={() => navigate(`/sales/${row.id}`)}
              >
                <TableCell>
                  <span className="font-semibold text-primary">{row.invoice_no}</span>
                  <p className="text-[11px] text-text-muted">
                    {formatInvoiceDateTime(row.sale_at)}
                  </p>
                </TableCell>

                {show('customer') ? (
                  <TableCell>
                    <p className="text-sm font-medium">
                      {row.customer_name ?? 'Walk-in Customer'}
                    </p>
                    {row.customer_phone ? (
                      <p className="text-[11px] text-text-muted">{row.customer_phone}</p>
                    ) : null}
                  </TableCell>
                ) : null}

                {show('items') ? (
                  <TableCell className="text-right">
                    <p className="text-sm tabular-nums">{row.item_qty.toLocaleString('en-US')} items</p>
                    <p className="max-w-[200px] truncate text-[11px] text-text-muted">
                      {formatCategoryChips(row.category_summary, 2)}
                    </p>
                  </TableCell>
                ) : null}

                <TableCell className="text-right">
                  <span className="font-bold tabular-nums text-text-primary">
                    {formatBDT(row.grand_total)}
                  </span>
                </TableCell>

                {show('paid') ? (
                  <TableCell className="text-right">
                    <span className="font-medium tabular-nums text-success">
                      {formatBDT(row.paid_total)}
                    </span>
                  </TableCell>
                ) : null}

                {show('due') ? (
                  <TableCell className="text-right">
                    {row.due_total > 0 ? (
                      <span className="font-semibold tabular-nums text-danger">
                        {formatBDT(row.due_total)}
                      </span>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </TableCell>
                ) : null}

                <TableCell>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                  {note ? (
                    <p className="mt-0.5 text-[10px] text-text-muted">{note}</p>
                  ) : null}
                </TableCell>

                <TableCell
                  className="sticky right-0 bg-white text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <SalesRowActions sale={row} />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
