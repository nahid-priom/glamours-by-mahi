import type { SaleStatus } from '@/database/schema'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const config: Record<
  SaleStatus,
  { label: string; dot: string; variant: 'success' | 'warning' | 'info' | 'danger' | 'default' }
> = {
  Completed: { label: 'Completed', dot: 'bg-emerald-500', variant: 'success' },
  'Partial Paid': { label: 'Partial Paid', dot: 'bg-amber-400', variant: 'warning' },
  Processing: { label: 'Processing', dot: 'bg-sky-500', variant: 'info' },
  Returned: { label: 'Returned', dot: 'bg-red-500', variant: 'danger' },
  Cancelled: { label: 'Cancelled', dot: 'bg-slate-500', variant: 'default' },
}

export function SaleStatusBadge({ status, className }: { status: SaleStatus; className?: string }) {
  const c = config[status] ?? config.Cancelled
  return (
    <Badge variant={c.variant} className={cn('gap-1.5 font-medium', className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', c.dot)} aria-hidden />
      {c.label}
    </Badge>
  )
}
