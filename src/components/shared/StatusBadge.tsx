import type { OrderStatus } from '@/lib/constants'
import { Badge } from '@/components/ui/badge'

const statusVariant: Record<OrderStatus, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple'> = {
  New: 'info',
  Confirmed: 'purple',
  Packed: 'purple',
  'Courier Booked': 'warning',
  Shipped: 'warning',
  Delivered: 'success',
  Returned: 'danger',
  Cancelled: 'default',
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={statusVariant[status]}>{status}</Badge>
}
