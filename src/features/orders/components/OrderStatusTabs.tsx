import type { OrderStatus } from '@/lib/constants'
import { cn } from '@/lib/utils'

const folders: { key: OrderStatus | 'all' | 'high_fraud'; label: string }[] = [
  { key: 'all', label: 'All Orders' },
  { key: 'New', label: 'New' },
  { key: 'Confirmed', label: 'Confirmed' },
  { key: 'Packed', label: 'Packed' },
  { key: 'Courier Booked', label: 'Courier Booked' },
  { key: 'Shipped', label: 'Shipped' },
  { key: 'Delivered', label: 'Delivered' },
  { key: 'Returned', label: 'Returned' },
  { key: 'Cancelled', label: 'Cancelled' },
  { key: 'high_fraud', label: 'High Fraud Risk' },
]

interface OrderStatusTabsProps {
  active: string
  onChange: (key: string) => void
}

export function OrderStatusTabs({ active, onChange }: OrderStatusTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {folders.map((f) => (
        <button
          key={f.key}
          type="button"
          onClick={() => onChange(f.key)}
          className={cn(
            'shrink-0 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors',
            active === f.key
              ? 'bg-primary text-white'
              : 'border border-border bg-white text-text-muted hover:bg-slate-50',
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}
