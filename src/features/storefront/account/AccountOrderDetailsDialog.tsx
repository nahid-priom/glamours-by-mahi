import { useQuery } from '@tanstack/react-query'
import { Check, Circle, Printer, ShieldCheck } from 'lucide-react'
import type { Order } from '@/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatBDT, formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { storefrontService } from '../storefront.service'
import { ProductImage } from '@/components/common/ProductImage'

interface AccountOrderDetailsDialogProps {
  order: Order | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AccountOrderDetailsDialog({ order, open, onOpenChange }: AccountOrderDetailsDialogProps) {
  const { data: tracking } = useQuery({
    queryKey: ['account', 'order-tracking', order?.order_id],
    queryFn: () => storefrontService.trackOrder(order!.order_id),
    enabled: !!order && open,
  })

  const { data: product } = useQuery({
    queryKey: ['account', 'order-product', order?.product_id],
    queryFn: () => storefrontService.getProductById(order!.product_id!),
    enabled: !!order?.product_id && open,
  })

  if (!order) return null

  const timeline = tracking?.timeline ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-3xl border-[#22171C]/8 p-0">
        <div className="border-b border-[#22171C]/8 p-6">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Order Details</DialogTitle>
            <DialogDescription className="font-mono text-sm">{order.order_id}</DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <StatusBadge status={order.status} />
            {order.fraud_level === 'SAFE' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-600">
                <ShieldCheck className="h-3 w-3" />
                Fraud Safe
              </span>
            )}
          </div>
        </div>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto p-6">
          <div className="flex gap-4 rounded-2xl border border-[#22171C]/8 bg-[#FFF9FB]/50 p-4">
            <div className="h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-white">
              {product ? (
                <ProductImage product={product} alt={product.alt} className="h-20 w-16" aspectRatio="portrait" />
              ) : (
                <div className="flex h-full items-center justify-center text-[10px] text-[#6B7280]">No image</div>
              )}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-[#22171C]">{order.product_name}</p>
              <p className="mt-1 text-sm text-[#6B7280]">Qty: {order.quantity}</p>
              <p className="mt-2 text-sm font-semibold text-[#FF3F7F]">{formatBDT(order.cod_amount)}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <InfoBlock title="Customer" lines={[order.customer_name, order.customer_phone, order.delivery_address]} />
            <InfoBlock
              title="Payment"
              lines={[
                `COD: ${formatBDT(order.cod_amount)}`,
                `Status: ${order.payment_status ?? 'pending'}`,
                `Placed: ${formatDateTime(order.created_at)}`,
              ]}
            />
            {(order.courier_name || order.tracking_id) && (
              <InfoBlock
                title="Courier"
                lines={[
                  order.courier_name ?? '—',
                  order.tracking_id ? `Tracking: ${order.tracking_id}` : '',
                ].filter(Boolean)}
                className="sm:col-span-2"
              />
            )}
          </div>

          {timeline.length > 0 && (
            <div className="rounded-2xl border border-[#22171C]/8 p-4">
              <h4 className="font-serif text-lg text-[#22171C]">Delivery Timeline</h4>
              <ol className="mt-4 space-y-3">
                {timeline.map((step, idx) => (
                  <li key={`${step.status}-${idx}`} className="flex gap-3">
                    <div
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                        step.done ? 'bg-emerald-500 text-white' : 'border-2 border-[#22171C]/10 text-[#6B7280]',
                      )}
                    >
                      {step.done ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3 w-3" />}
                    </div>
                    <div>
                      <p className={cn('text-sm font-medium', step.done ? 'text-[#22171C]' : 'text-[#6B7280]')}>
                        {step.status}
                      </p>
                      {step.date && <p className="text-xs text-[#6B7280]">{formatDateTime(step.date)}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-[#22171C]/8 p-6">
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => window.open(`/print/orders/${order.id}/invoice`, '_blank')}
          >
            <Printer className="mr-2 h-4 w-4" />
            Print Invoice
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function InfoBlock({
  title,
  lines,
  className,
}: {
  title: string
  lines: string[]
  className?: string
}) {
  return (
    <div className={cn('rounded-2xl border border-[#22171C]/8 p-4', className)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6B7280]">{title}</p>
      <div className="mt-2 space-y-1">
        {lines.map((line) => (
          <p key={line} className="text-sm text-[#22171C]">
            {line}
          </p>
        ))}
      </div>
    </div>
  )
}
