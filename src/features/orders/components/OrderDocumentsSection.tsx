import { Printer, Truck, Gift } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { QRCodeBox } from '@/components/common/QRCodeBox'
import { buildTrackingQrValue } from '@/features/print/print.utils'
import { orderToPrintData } from '@/features/print/print.service'
import { StatusBadge } from '@/components/shared/StatusBadge'
import type { Order } from '@/types'

function openPrint(path: string) {
  window.open(path, '_blank', 'noopener,noreferrer')
}

interface OrderDocumentsSectionProps {
  order: Order
}

export function OrderDocumentsSection({ order }: OrderDocumentsSectionProps) {
  const printData = orderToPrintData(order)
  const qrValue = buildTrackingQrValue(printData)

  return (
    <div className="rounded-xl border border-border bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Documents</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="purple" size="sm" onClick={() => openPrint(`/print/orders/${order.id}/invoice`)}>
          <Printer className="h-3.5 w-3.5" /> A4 Invoice
        </Button>
        <Button variant="blue" size="sm" onClick={() => openPrint(`/print/orders/${order.id}/shipping-label`)}>
          <Truck className="h-3.5 w-3.5" /> Shipping Label
        </Button>
        <Button variant="success" size="sm" onClick={() => openPrint(`/print/orders/${order.id}/gift-label`)}>
          <Gift className="h-3.5 w-3.5" /> Gift Label
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-text-muted">Tracking ID</p>
          <p className="font-mono text-xs font-semibold">{order.tracking_id ?? 'Not assigned'}</p>
          <p className="mt-2 text-xs text-text-muted">Courier Status</p>
          <div className="mt-1">
            <StatusBadge status={order.status} />
          </div>
          {order.courier_name && (
            <p className="mt-1 text-xs">{order.courier_name}</p>
          )}
        </div>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-white p-2">
          <QRCodeBox value={qrValue} size={80} label="Scan to track" />
        </div>
      </div>
    </div>
  )
}
