import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Truck } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FraudRiskBadge } from '@/features/fraud/FraudRiskBadge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { OrderDocumentsSection } from './components/OrderDocumentsSection'
import { ordersService } from './orders.service'
import { customersService } from '@/features/customers/customers.service'
import { formatBDT, formatDateShort } from '@/lib/format'
import type { Order } from '@/types'
import { MOCK_COURIERS } from '@/lib/mock-data'
import { ORDER_STATUSES } from '@/lib/constants'
import { useToast } from '@/components/ui/toast'

interface OrderDetailsDrawerProps {
  order: Order | null
  onClose: () => void
}

export function OrderDetailsDrawer({ order, onClose }: OrderDetailsDrawerProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [note, setNote] = useState('')
  const [noteType, setNoteType] = useState<'customer' | 'order'>('order')

  const { data: liveOrder } = useQuery({
    queryKey: ['orders', order?.id],
    queryFn: () => ordersService.getOrderById(order!.id),
    enabled: !!order?.id,
    initialData: order ?? undefined,
  })

  const displayOrder = liveOrder ?? order

  const { data: customer } = useQuery({
    queryKey: ['customer', displayOrder?.customer_phone],
    queryFn: () => customersService.getCustomerByPhone(displayOrder!.customer_phone),
    enabled: !!displayOrder?.customer_phone,
  })

  const bookMutation = useMutation({
    mutationFn: ({ id, courierId, name }: { id: string; courierId: string; name: string }) =>
      ordersService.bookCourier(id, courierId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      toast('Courier booked successfully')
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: typeof ORDER_STATUSES[number] }) =>
      ordersService.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      toast('Status updated')
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const noteMutation = useMutation({
    mutationFn: () => ordersService.addNote(displayOrder!.id, note, noteType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      toast('Note saved')
      setNote('')
    },
  })

  if (!displayOrder) return null

  const address = displayOrder.delivery_address ?? displayOrder.customer_address ?? ''
  const canBook = ['Confirmed', 'Packed'].includes(displayOrder.status) && !displayOrder.deleted_at
  const canEdit = displayOrder.status !== 'Delivered' && !displayOrder.deleted_at

  return (
    <Sheet open={!!order} onOpenChange={onClose}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{displayOrder.order_id}</SheetTitle>
          <SheetDescription>{formatDateShort(displayOrder.created_at)}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4 px-1">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-text-muted">Customer</p>
              <p className="font-medium">{displayOrder.customer_name}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Phone</p>
              <p className="font-medium">{displayOrder.customer_phone}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-text-muted">Address</p>
              <p className="break-words font-medium">{address}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Store</p>
              <p className="font-medium">{displayOrder.store_name}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">COD</p>
              <p className="font-medium">{formatBDT(displayOrder.cod_amount)}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Product</p>
              <p className="font-medium">{displayOrder.product_name}</p>
              {displayOrder.sku && <p className="text-xs text-text-muted">SKU: {displayOrder.sku}</p>}
            </div>
            <div>
              <p className="text-xs text-text-muted">Qty</p>
              <p className="font-medium">{displayOrder.quantity}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Status</p>
              <StatusBadge status={displayOrder.status} />
            </div>
            <div>
              <p className="text-xs text-text-muted">Fraud Risk</p>
              <FraudRiskBadge level={displayOrder.fraud_level} score={displayOrder.fraud_score} />
            </div>
          </div>

          <OrderDocumentsSection order={displayOrder} />

          {customer && (
            <div className="rounded-xl border border-border bg-slate-50 p-3 text-sm">
              <p className="text-xs font-semibold text-text-muted">Customer History</p>
              <p className="mt-1">
                Orders: {customer.total_orders} · Delivered: {customer.delivered_orders} · Return rate:{' '}
                {customer.return_rate}%
              </p>
            </div>
          )}

          {(displayOrder.customer_note || displayOrder.order_note || displayOrder.order_task_note) && (
            <div className="space-y-2 text-sm">
              {displayOrder.customer_note && (
                <div className="rounded-xl border bg-slate-50 p-3">
                  <p className="text-xs font-medium text-text-muted">Customer Note</p>
                  <p>{displayOrder.customer_note}</p>
                </div>
              )}
              {(displayOrder.order_note || displayOrder.order_task_note) && (
                <div className="rounded-xl border bg-amber-50 p-3">
                  <p className="text-xs font-medium text-text-muted">Order Note</p>
                  <p>{displayOrder.order_note ?? displayOrder.order_task_note}</p>
                </div>
              )}
            </div>
          )}

          {displayOrder.activity_log && displayOrder.activity_log.length > 0 && (
            <div className="rounded-xl border p-3">
              <p className="text-xs font-semibold text-text-muted">Activity</p>
              <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs">
                {displayOrder.activity_log.map((a) => (
                  <li key={a.id} className="text-text-muted">
                    <span className="text-foreground">{a.message}</span>
                    <span className="ml-1 opacity-60">· {formatDateShort(a.created_at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs">Add Note</Label>
            <Select value={noteType} onValueChange={(v) => setNoteType(v as 'customer' | 'order')}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="order">Order Note</SelectItem>
                <SelectItem value="customer">Customer Note</SelectItem>
              </SelectContent>
            </Select>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Type note..." />
            <Button size="sm" variant="outline" disabled={!note.trim()} onClick={() => noteMutation.mutate()}>
              Save Note
            </Button>
          </div>

          {!displayOrder.deleted_at && (
            <div className="space-y-2">
              <Label className="text-xs">Change Status</Label>
              <Select
                value={displayOrder.status}
                onValueChange={(v) =>
                  statusMutation.mutate({ id: displayOrder.id, status: v as typeof ORDER_STATUSES[number] })
                }
                disabled={displayOrder.status === 'Delivered'}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ORDER_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <Button variant="warning" size="sm" asChild>
                <Link to={`/orders/${displayOrder.id}/edit`}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Link>
              </Button>
            )}
            {canBook && (
              <Button
                variant="success"
                size="sm"
                disabled={bookMutation.isPending}
                onClick={() =>
                  bookMutation.mutate({ id: displayOrder.id, courierId: 'c1', name: MOCK_COURIERS[0].name })
                }
              >
                <Truck className="h-3.5 w-3.5" /> Book Courier
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
