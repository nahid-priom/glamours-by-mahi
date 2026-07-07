import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { FraudRiskBadge } from '@/features/fraud/FraudRiskBadge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatBDT, formatRelativeTime } from '@/lib/format'
import type { Order } from '@/types'
import { cn } from '@/lib/utils'

interface OrderTableProps {
  orders: Order[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onToggleAll: () => void
  onView: (order: Order) => void
  onOpenActionSheet: (order: Order) => void
}

function paymentLabel(status?: string) {
  if (status === 'collected') return 'Collected'
  if (status === 'refunded') return 'Refunded'
  return 'Pending'
}

export function OrderTable({
  orders,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  onView,
  onOpenActionSheet,
}: OrderTableProps) {
  if (orders.length === 0) {
    return <EmptyState title="No orders found" description="Try adjusting filters or create a new order." />
  }

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block">
        <table className="w-full table-fixed text-xs">
          <thead>
            <tr className="border-b border-border bg-slate-50 text-left text-text-muted">
              <th className="w-10 px-3 py-3">
                <Checkbox
                  checked={orders.length > 0 && selectedIds.size === orders.length}
                  onCheckedChange={onToggleAll}
                />
              </th>
              <th className="w-[16%] px-3 py-3 font-medium">Order</th>
              <th className="w-[18%] px-3 py-3 font-medium">Customer</th>
              <th className="w-[18%] px-3 py-3 font-medium">Product</th>
              <th className="w-[14%] px-3 py-3 font-medium">Payment</th>
              <th className="w-[18%] px-3 py-3 font-medium">Delivery</th>
              <th className="w-[16%] px-3 py-3 font-medium">Risk & Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const address = order.delivery_address ?? order.customer_address ?? ''
              return (
                <tr
                  key={order.id}
                  className={cn(
                    'border-b border-border/50 hover:bg-slate-50/50',
                    order.deleted_at && 'opacity-60',
                  )}
                >
                  <td className="px-3 py-3">
                    <Checkbox
                      checked={selectedIds.has(order.id)}
                      onCheckedChange={() => onToggleSelect(order.id)}
                    />
                  </td>

                  <td className="px-3 py-3">
                    <button type="button" className="text-left" onClick={() => onView(order)}>
                      <p className="truncate font-semibold text-primary">{order.order_id}</p>
                      <p className="truncate text-text-muted">{order.store_name}</p>
                      <p className="mt-0.5 text-[10px] text-text-muted">
                        {formatRelativeTime(order.updated_at)}
                      </p>
                    </button>
                  </td>

                  <td className="px-3 py-3">
                    <p className="truncate font-medium">{order.customer_name}</p>
                    <p className="truncate text-text-muted">{order.customer_phone}</p>
                    <p className="mt-0.5 truncate text-[10px] text-text-muted" title={address}>
                      {address}
                    </p>
                  </td>

                  <td className="px-3 py-3">
                    <p className="truncate font-medium">{order.product_name}</p>
                    {order.sku && (
                      <p className="truncate font-mono text-[10px] text-text-muted">{order.sku}</p>
                    )}
                    <p className="mt-0.5 text-text-muted">Qty: {order.quantity}</p>
                  </td>

                  <td className="px-3 py-3">
                    <p className="text-sm font-bold">{formatBDT(order.cod_amount)}</p>
                    <p className="mt-0.5 text-[10px] capitalize text-text-muted">
                      {paymentLabel(order.payment_status)}
                    </p>
                  </td>

                  <td className="px-3 py-3">
                    <p className="truncate font-medium">{order.courier_name ?? '—'}</p>
                    <p className="truncate font-mono text-[10px] text-text-muted">
                      {order.tracking_id ?? 'No tracking'}
                    </p>
                    <div className="mt-1">
                      <StatusBadge status={order.status} />
                    </div>
                  </td>

                  <td className="px-3 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <FraudRiskBadge level={order.fraud_level} />
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 shrink-0 gap-1 px-2"
                        onClick={() => onOpenActionSheet(order)}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                        <span className="hidden lg:inline">More</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 p-4 md:hidden">
        {orders.map((order) => (
          <div
            key={order.id}
            className={cn('rounded-xl border border-border p-4', order.deleted_at && 'opacity-60')}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-primary">{order.order_id}</p>
                <p className="text-sm font-medium">{order.customer_name}</p>
                <p className="text-xs text-text-muted">{order.customer_phone}</p>
              </div>
              <StatusBadge status={order.status} />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="min-w-0">
                <p className="text-text-muted">Product</p>
                <p className="truncate font-medium">{order.product_name}</p>
              </div>
              <div className="text-right">
                <p className="text-text-muted">COD</p>
                <p className="font-bold">{formatBDT(order.cod_amount)}</p>
              </div>
              <div className="min-w-0">
                <p className="text-text-muted">Courier</p>
                <p className="truncate">{order.courier_name ?? '—'}</p>
              </div>
              <div className="min-w-0 text-right">
                <p className="text-text-muted">Tracking</p>
                <p className="truncate font-mono text-[10px]">{order.tracking_id ?? '—'}</p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <FraudRiskBadge level={order.fraud_level} />
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedIds.has(order.id)}
                  onCheckedChange={() => onToggleSelect(order.id)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 min-w-[72px] gap-1"
                  onClick={() => onOpenActionSheet(order)}
                >
                  <MoreHorizontal className="h-4 w-4" />
                  More
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
