import { Printer, Truck, Gift, RefreshCw, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { OrderStatus } from '@/lib/constants'
import { ORDER_STATUSES } from '@/lib/constants'

interface OrderBulkActionsProps {
  selectedIds: Set<string>
  onBulkStatus: (status: OrderStatus) => void
  onBulkBookCourier: () => void
  onClear: () => void
  statusLoading?: boolean
  courierLoading?: boolean
}

export function OrderBulkActions({
  selectedIds,
  onBulkStatus,
  onBulkBookCourier,
  onClear,
  statusLoading,
  courierLoading,
}: OrderBulkActionsProps) {
  const count = selectedIds.size
  if (count === 0) return null

  const ids = Array.from(selectedIds).join(',')

  const openBulk = (path: string) => {
    window.open(path, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
      <span className="text-xs font-semibold text-primary">{count} selected</span>

      <Select onValueChange={(v) => onBulkStatus(v as OrderStatus)} disabled={statusLoading}>
        <SelectTrigger className="h-8 w-[140px] text-xs">
          <SelectValue placeholder="Bulk status" />
        </SelectTrigger>
        <SelectContent>
          {ORDER_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button variant="success" size="sm" onClick={onBulkBookCourier} disabled={courierLoading}>
        <Package className="h-3.5 w-3.5" />
        Bulk Book Courier
      </Button>

      <Button variant="purple" size="sm" onClick={() => openBulk(`/print/orders/bulk/invoices?ids=${ids}`)}>
        <Printer className="h-3.5 w-3.5" />
        Bulk A4 Invoice
      </Button>
      <Button variant="blue" size="sm" onClick={() => openBulk(`/print/orders/bulk/shipping-labels?ids=${ids}`)}>
        <Truck className="h-3.5 w-3.5" />
        Bulk Shipping Label
      </Button>
      <Button variant="success" size="sm" onClick={() => openBulk(`/print/orders/bulk/gift-labels?ids=${ids}`)}>
        <Gift className="h-3.5 w-3.5" />
        Bulk Gift Label
      </Button>

      <Button variant="ghost" size="sm" onClick={onClear}>
        <RefreshCw className="h-3.5 w-3.5" />
        Clear
      </Button>
    </div>
  )
}
