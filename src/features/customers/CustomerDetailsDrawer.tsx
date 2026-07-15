import { useQuery } from '@tanstack/react-query'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { FraudRiskBadge } from '@/features/fraud/FraudRiskBadge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ordersService } from '@/features/storefront/legacy-oms/orders.service'
import { customersService } from './customers.service'
import { formatBDT, formatDateShort } from '@/lib/format'
import type { Customer } from './customers.types'
import { Ban, ShieldAlert } from 'lucide-react'

interface CustomerDetailsDrawerProps {
  customer: Customer | null
  onClose: () => void
}

export function CustomerDetailsDrawer({ customer, onClose }: CustomerDetailsDrawerProps) {
  const { data: liveCustomer } = useQuery({
    queryKey: ['customers', customer?.id],
    queryFn: () => customersService.getById(customer!.id),
    enabled: !!customer?.id,
    initialData: customer ?? undefined,
  })

  const display = liveCustomer ?? customer

  const { data: allOrders } = useQuery({
    queryKey: ['orders', 'customer', display?.id],
    queryFn: () => ordersService.getOrders(),
    enabled: !!display?.id,
  })

  const customerOrders =
    allOrders?.filter(
      (o) => o.customer_id === display?.id || o.customer_phone === display?.phone,
    ) ?? []

  return (
    <Sheet open={!!customer} onOpenChange={() => onClose()}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        {display && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                {display.name}
                {display.is_blacklisted && (
                  <Badge variant="danger" className="text-xs">
                    <Ban className="mr-1 h-3 w-3" />
                    Blacklisted
                  </Badge>
                )}
              </SheetTitle>
              <SheetDescription>{display.phone}</SheetDescription>
            </SheetHeader>

            <div className="mt-4 space-y-4 px-5 pb-6 text-sm">
              <div className="rounded-xl border border-border bg-slate-50 p-3">
                <p className="text-xs font-semibold text-text-muted">Profile</p>
                <div className="mt-2 space-y-1.5">
                  <p>
                    <span className="text-text-muted">Email:</span>{' '}
                    {display.email || '—'}
                  </p>
                  <p>
                    <span className="text-text-muted">Address:</span> {display.address || '—'}
                  </p>
                  <p>
                    <span className="text-text-muted">District:</span> {display.district || '—'}
                  </p>
                  <p>
                    <span className="text-text-muted">Status:</span>{' '}
                    <Badge
                      variant={
                        display.status === 'active'
                          ? 'success'
                          : display.status === 'blocked'
                            ? 'danger'
                            : 'default'
                      }
                    >
                      {display.status}
                    </Badge>
                  </p>
                  <p>
                    <span className="text-text-muted">Total Spent:</span>{' '}
                    {formatBDT(display.total_spent)}
                  </p>
                  <p className="text-xs text-text-muted">
                    Joined {formatDateShort(display.created_at)}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-border p-3">
                <p className="flex items-center gap-1 text-xs font-semibold text-text-muted">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Fraud & Risk
                </p>
                <div className="mt-2 space-y-2">
                  <FraudRiskBadge level={display.fraud_level} />
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-text-muted">Return Rate</p>
                      <p className="font-semibold">{display.return_rate}%</p>
                    </div>
                    <div>
                      <p className="text-text-muted">Returned</p>
                      <p className="font-semibold text-danger">{display.returned_orders}</p>
                    </div>
                    <div>
                      <p className="text-text-muted">Delivered</p>
                      <p className="font-semibold text-success">{display.delivered_orders}</p>
                    </div>
                    <div>
                      <p className="text-text-muted">Cancelled</p>
                      <p className="font-semibold">{display.cancelled_orders}</p>
                    </div>
                  </div>
                  {display.is_blacklisted && display.blacklist_reason && (
                    <div className="rounded-lg border border-danger/20 bg-red-50 p-2 text-xs text-danger">
                      <p className="font-medium">Blacklist Reason</p>
                      <p>{display.blacklist_reason}</p>
                    </div>
                  )}
                </div>
              </div>

              {display.customer_note && (
                <div className="rounded-xl border border-border bg-amber-50 p-3">
                  <p className="text-xs font-medium text-text-muted">Customer Note</p>
                  <p className="mt-1">{display.customer_note}</p>
                </div>
              )}

              <div className="rounded-xl border border-border p-3">
                <p className="text-xs font-semibold text-text-muted">
                  Order History ({customerOrders.length})
                </p>
                {customerOrders.length === 0 ? (
                  <p className="mt-2 text-xs text-text-muted">No orders yet</p>
                ) : (
                  <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                    {customerOrders.map((order) => (
                      <li
                        key={order.id}
                        className="flex items-center justify-between rounded-lg border border-border/60 bg-white p-2 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{order.order_id}</p>
                          <p className="truncate text-text-muted">{order.product_name}</p>
                        </div>
                        <div className="ml-2 shrink-0 text-right">
                          <StatusBadge status={order.status} />
                          <p className="mt-0.5 font-medium">{formatBDT(order.cod_amount)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
