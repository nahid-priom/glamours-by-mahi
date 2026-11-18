import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatBDT } from '@/lib/format'
import { queryKeys } from '@/lib/query/keys'
import { formatActivityDate } from '../utils/customer-display'
import { listCustomerSales } from '../repositories/customers.repository'

type Props = {
  customerId: string
}

export function CustomerOrdersTab({ customerId }: Props) {
  const { data: sales = [], isLoading, error } = useQuery({
    queryKey: queryKeys.customerSales(customerId, { limit: 30 }),
    queryFn: () => listCustomerSales(customerId, 30),
    enabled: Boolean(customerId),
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Sales history</h2>
          <p className="text-xs text-muted-foreground">Recent invoices for this customer.</p>
        </div>
        <Button size="sm" variant="outline" asChild>
          <Link to={`/sales?customerId=${customerId}`}>
            <ExternalLink className="mr-1.5 h-4 w-4" />
            View all sales
          </Link>
        </Button>
      </div>

      {error ? <p className="text-sm text-[#E11D48]">Could not load sales.</p> : null}

      <div className="rounded-xl border border-border bg-white">
        {isLoading ? (
          <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading sales…
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell>
                    <Link to={`/sales/${sale.id}`} className="font-medium text-[#2563EB] hover:underline">
                      {sale.invoice_no}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatActivityDate(sale.created_at)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="default">{sale.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        sale.payment_status === 'paid'
                          ? 'success'
                          : sale.payment_status === 'unpaid'
                            ? 'warning'
                            : 'info'
                      }
                    >
                      {sale.payment_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBDT(sale.grand_total)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-[#E11D48]">
                    {sale.due_total > 0 ? formatBDT(sale.due_total) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!isLoading && sales.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No sales yet.</p>
        ) : null}
      </div>
    </div>
  )
}
