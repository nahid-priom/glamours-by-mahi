import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatBDT } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import {
  useCancelOnlineOrder,
  useFulfilOnlineOrder,
  useOnlineOrders,
} from '../hooks/use-online-orders'

export function OnlineOrdersPage() {
  const [status, setStatus] = useState<string>('')
  const { data = [], isLoading, error, refetch } = useOnlineOrders(status || undefined)
  const fulfil = useFulfilOnlineOrder()
  const cancel = useCancelOnlineOrder()
  const { toast } = useToast()

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">Online Orders</h1>
          <p className="text-sm text-[#6B7280]">
            Reserved at checkout. Fulfilment posts stock, AR, and journals once.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="h-9 rounded-md border border-border bg-white px-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="new">New</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
            <option value="draft">Draft</option>
            <option value="completed">Completed</option>
          </select>
          <Button variant="outline" onClick={() => void refetch()}>
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{(error as Error).message}</p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-[#F9FAFB] text-left text-xs uppercase text-[#6B7280]">
            <tr>
              <th className="px-3 py-2">Invoice</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Expires</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="px-3 py-6 text-[#6B7280]" colSpan={6}>
                  Loading…
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-[#6B7280]" colSpan={6}>
                  No online orders found.
                </td>
              </tr>
            ) : (
              data.map((row) => {
                const canFulfil =
                  row.status === 'draft' && row.fulfilment_status !== 'cancelled'
                return (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <Link className="font-medium text-[#E11D48]" to={`/sales/${row.id}`}>
                        {row.invoice_no}
                      </Link>
                      <div className="text-xs text-[#9CA3AF]">{row.delivery_district}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div>{row.customer_name ?? '—'}</div>
                      <div className="text-xs text-[#6B7280]">{row.customer_phone}</div>
                    </td>
                    <td className="px-3 py-2">{formatBDT(Number(row.grand_total ?? 0))}</td>
                    <td className="px-3 py-2">
                      <div>{row.fulfilment_status ?? row.status}</div>
                      <div className="text-xs text-[#9CA3AF]">{row.status}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-[#6B7280]">
                      {row.reservation_expires_at
                        ? new Date(row.reservation_expires_at).toLocaleString()
                        : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        {canFulfil ? (
                          <>
                            <Button
                              size="sm"
                              disabled={fulfil.isPending}
                              onClick={() => {
                                fulfil.mutate(row.id, {
                                  onSuccess: () => toast('Order fulfilled', 'success'),
                                  onError: (e) => toast((e as Error).message, 'error'),
                                })
                              }}
                            >
                              Fulfil
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={cancel.isPending}
                              onClick={() => {
                                cancel.mutate(
                                  { saleId: row.id },
                                  {
                                    onSuccess: () => toast('Order cancelled', 'success'),
                                    onError: (e) => toast((e as Error).message, 'error'),
                                  },
                                )
                              }}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
