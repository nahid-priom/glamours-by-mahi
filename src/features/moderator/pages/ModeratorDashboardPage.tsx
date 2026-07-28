import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { formatBDT } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/EmptyState'
import { getModeratorDashboardSummary } from '../repositories/moderator.repository'

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-white px-3 py-3">
      <p className="text-[11px] uppercase tracking-wide text-[#6B7280]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[#111827]">{value}</p>
    </div>
  )
}

export function ModeratorDashboardPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['moderator-dashboard'],
    queryFn: () => getModeratorDashboardSummary({ ownOnly: true }),
    staleTime: 30_000,
  })

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">Moderator dashboard</h1>
          <p className="text-sm text-[#6B7280]">Your online order intake performance</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void refetch()}>
            Refresh
          </Button>
          <Button asChild>
            <Link to="/moderator/orders/new">New order</Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-[#F3F4F6]" />
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-[#E11D48]">{(error as Error).message}</p>
      ) : null}

      {data ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Today" value={String(data.orders_today)} />
            <Kpi label="This month" value={String(data.orders_month)} />
            <Kpi label="Draft / open" value={String(data.draft_orders)} />
            <Kpi label="Pending approval" value={String(data.pending_approval)} />
            <Kpi label="Approved" value={String(data.approved_orders)} />
            <Kpi label="Cancelled" value={String(data.cancelled_orders)} />
            <Kpi label="Delivered / done" value={String(data.delivered_orders)} />
            <Kpi label="Month value" value={formatBDT(data.total_order_value)} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Kpi label="Average order value" value={formatBDT(data.average_order_value)} />
          </div>

          <div className="rounded-xl border border-border bg-white">
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold text-[#111827]">Recent orders</h2>
            </div>
            {data.recent_orders.length === 0 ? (
              <EmptyState title="No orders yet" description="Create your first moderator order." />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-[#F9FAFB] text-left text-xs uppercase text-[#6B7280]">
                    <tr>
                      <th className="px-3 py-2">Invoice</th>
                      <th className="px-3 py-2">Customer</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Total</th>
                      <th className="px-3 py-2">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_orders.map((row) => (
                      <tr key={row.id} className="border-t">
                        <td className="px-3 py-2">
                          <Link to={`/sales/${row.id}`} className="font-medium text-[#E11D48]">
                            {row.invoice_no}
                          </Link>
                        </td>
                        <td className="px-3 py-2">
                          <div>{row.customer_name ?? '—'}</div>
                          <div className="text-xs text-[#6B7280]">{row.customer_phone}</div>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {row.fulfilment_status ?? row.status}
                        </td>
                        <td className="px-3 py-2">{formatBDT(Number(row.grand_total))}</td>
                        <td className="px-3 py-2 text-xs text-[#6B7280]">
                          {new Date(row.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
