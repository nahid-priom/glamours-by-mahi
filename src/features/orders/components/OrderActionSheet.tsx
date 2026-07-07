import type { ReactNode } from 'react'
import {
  Eye,
  Pencil,
  Printer,
  Truck,
  Gift,
  RefreshCw,
  MapPin,
  XCircle,
  Trash2,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StatusBadge } from '@/components/shared/StatusBadge'
import type { Order } from '@/types'
import { cn } from '@/lib/utils'

interface OrderActionSheetProps {
  order: Order | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onView: () => void
  onEdit: () => void
  onPrintInvoice: () => void
  onPrintShippingLabel: () => void
  onPrintGiftLabel: () => void
  onBookCourier: () => void
  onTrackCourier: () => void
  onChangeStatus: () => void
  onCancelOrder: () => void
  onDeleteOrder: () => void
}

type ActionVariant = 'default' | 'print' | 'courier' | 'danger'

interface ActionTileProps {
  icon: ReactNode
  label: string
  hint?: string
  onClick: () => void
  disabled?: boolean
  variant?: ActionVariant
  className?: string
}

function ActionTile({
  icon,
  label,
  hint,
  onClick,
  disabled,
  variant = 'default',
  className,
}: ActionTileProps) {
  const variantClass = {
    default: 'border-border bg-white hover:bg-slate-50',
    print: 'border-border bg-slate-50 hover:bg-slate-100',
    courier: 'border-green-200 bg-green-50 hover:bg-green-100 text-green-900',
    danger: 'border-red-200 bg-red-50 hover:bg-red-100 text-red-700',
  }[variant]

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex min-h-[52px] w-full flex-col items-start justify-center rounded-xl border px-3 py-2.5 text-left transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-45',
        variantClass,
        className,
      )}
    >
      <span className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {label}
      </span>
      {hint && <span className="mt-0.5 pl-6 text-[10px] text-text-muted">{hint}</span>}
    </button>
  )
}

export function OrderActionSheet({
  order,
  open,
  onOpenChange,
  onView,
  onEdit,
  onPrintInvoice,
  onPrintShippingLabel,
  onPrintGiftLabel,
  onBookCourier,
  onTrackCourier,
  onChangeStatus,
  onCancelOrder,
  onDeleteOrder,
}: OrderActionSheetProps) {
  if (!order) return null

  const isDeleted = !!order.deleted_at
  const isTerminal = ['Delivered', 'Returned', 'Cancelled'].includes(order.status)
  const hasTracking = !!order.tracking_id
  const canBook = !isDeleted && !isTerminal && !hasTracking
  const canEdit = !isDeleted && order.status !== 'Delivered'
  const canTrack = hasTracking
  const canCancel = !isDeleted && order.status !== 'Cancelled' && order.status !== 'Delivered'
  const canDelete = !isDeleted

  const run = (fn: () => void) => {
    fn()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,640px)] w-[calc(100%-2rem)] max-w-[420px] gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-4 py-4 pr-12 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="truncate text-base font-bold">{order.order_id}</DialogTitle>
              <DialogDescription className="mt-1 truncate text-sm">
                {order.customer_name}
              </DialogDescription>
            </div>
            <StatusBadge status={order.status} />
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {!isDeleted && (
            <>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                Actions
              </p>
              <div className="grid grid-cols-2 gap-2">
                <ActionTile
                  icon={<Eye className="h-4 w-4 shrink-0" />}
                  label="View Details"
                  onClick={() => run(onView)}
                />
                <ActionTile
                  icon={<Pencil className="h-4 w-4 shrink-0" />}
                  label="Edit Order"
                  hint={!canEdit ? 'Locked after delivery' : undefined}
                  disabled={!canEdit}
                  onClick={() => run(onEdit)}
                />
                <ActionTile
                  icon={<Printer className="h-4 w-4 shrink-0" />}
                  label="A4 Invoice"
                  hint="Opens print view"
                  variant="print"
                  onClick={() => run(onPrintInvoice)}
                />
                <ActionTile
                  icon={<Truck className="h-4 w-4 shrink-0" />}
                  label="Shipping Label"
                  hint="Thermal label + barcode"
                  variant="print"
                  onClick={() => run(onPrintShippingLabel)}
                />
                <ActionTile
                  icon={<Gift className="h-4 w-4 shrink-0" />}
                  label="Gift Label"
                  variant="print"
                  onClick={() => run(onPrintGiftLabel)}
                />
                <ActionTile
                  icon={<RefreshCw className="h-4 w-4 shrink-0" />}
                  label="Change Status"
                  hint="Update workflow"
                  onClick={() => run(onChangeStatus)}
                />
              </div>

              <div className="mt-3">
                {hasTracking ? (
                  <ActionTile
                    icon={<MapPin className="h-4 w-4 shrink-0" />}
                    label="Track Courier"
                    hint={order.tracking_id ?? undefined}
                    variant="courier"
                    disabled={!canTrack}
                    onClick={() => run(onTrackCourier)}
                    className="col-span-2"
                  />
                ) : (
                  <ActionTile
                    icon={<Truck className="h-4 w-4 shrink-0" />}
                    label="Book Courier"
                    hint="Assign Steadfast + tracking ID"
                    variant="courier"
                    disabled={!canBook}
                    onClick={() => run(onBookCourier)}
                    className="col-span-2"
                  />
                )}
              </div>
            </>
          )}

          {isDeleted && (
            <ActionTile
              icon={<Eye className="h-4 w-4 shrink-0" />}
              label="View Details"
              onClick={() => run(onView)}
            />
          )}

          {!isDeleted && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-danger">
                Danger Zone
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <ActionTile
                  icon={<XCircle className="h-4 w-4 shrink-0" />}
                  label="Cancel Order"
                  hint="Requires confirmation"
                  variant="danger"
                  disabled={!canCancel}
                  onClick={() => run(onCancelOrder)}
                />
                <ActionTile
                  icon={<Trash2 className="h-4 w-4 shrink-0" />}
                  label="Delete Order"
                  hint="Archive from list"
                  variant="danger"
                  disabled={!canDelete}
                  onClick={() => run(onDeleteOrder)}
                />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
