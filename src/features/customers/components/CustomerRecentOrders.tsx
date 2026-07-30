import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { listCustomerRecentOrders } from '@/features/customer-rating'
import { useAuth } from '@/features/auth/auth-session'
import { formatBDT } from '@/lib/format'

type Props = {
  customerId: string
  limit?: number
}

export function CustomerRecentOrders({ customerId, limit = 8 }: Props) {
  const { can, profile } = useAuth()
  const orgId = profile?.organization_id ?? null
  const canOpenSale = can('sales.read')

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['customer-recent-orders', orgId, customerId, limit],
    queryFn: () => listCustomerRecentOrders(customerId, limit),
    enabled: Boolean(customerId) && Boolean(orgId),
    staleTime: 30_000,
  })

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[#111827]">Previous orders</p>
        <Button asChild variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs">
          <Link to={`/customers/${customerId}`}>
            Full record
            <ExternalLink className="h-3 w-3" />
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-[#6B7280]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </div>
      ) : null}

      {error ? (
        <p className="text-xs text-[#6B7280]">Could not load order history.</p>
      ) : null}

      {!isLoading && !error && data.length === 0 ? (
        <p className="text-xs text-[#6B7280]">No previous orders for this customer.</p>
      ) : null}

      {data.length > 0 ? (
        <ul className="divide-y divide-border">
          {data.map((order) => {
            const source = order.order_source || order.channel || null
            const body = (
              <>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-medium text-[#111827]">{order.invoice_no}</span>
                    <Badge variant="default" className="text-[10px]">
                      {order.status}
                    </Badge>
                    {source ? (
                      <span className="text-[10px] text-[#9CA3AF]">{source}</span>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-[#6B7280]">
                    {order.created_at ? new Date(order.created_at).toLocaleString() : '—'}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-semibold tabular-nums">
                  {formatBDT(order.grand_total)}
                </span>
              </>
            )

            return (
              <li key={order.id}>
                {canOpenSale ? (
                  <Link
                    to={`/sales/${order.id}`}
                    className="flex items-start gap-2 py-2 hover:bg-[#F9FAFB]"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-start gap-2 py-2">{body}</div>
                )}
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
