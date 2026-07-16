import { AlertTriangle } from 'lucide-react'
import { formatBDT } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ExpiryAlertRow } from '../repositories/catalog.repository'

type Props = {
  alert: ExpiryAlertRow
  className?: string
  onMarkRead?: (id: string) => void
}

const SEVERITY_STYLES = {
  info: 'border-blue-200 bg-blue-50 text-blue-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  critical: 'border-red-200 bg-red-50 text-red-900',
} as const

export function ExpiryAlertCard({ alert, className, onMarkRead }: Props) {
  const style = SEVERITY_STYLES[alert.severity as keyof typeof SEVERITY_STYLES] ?? SEVERITY_STYLES.warning

  return (
    <article className={cn('rounded-xl border p-3', style, className)}>
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{alert.product_name ?? 'Product'}</p>
          {alert.variant_name ? (
            <p className="text-xs opacity-80">{alert.variant_name}</p>
          ) : null}
          <p className="mt-1 text-xs">{alert.message}</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs opacity-90">
            <span>Expires: {alert.expires_at}</span>
            <span>Qty: {alert.quantity_available}</span>
            {alert.retail_hint != null ? <span>{formatBDT(alert.retail_hint)}</span> : null}
          </div>
        </div>
        {!alert.is_read && onMarkRead ? (
          <button
            type="button"
            className="shrink-0 text-xs font-medium underline"
            onClick={() => onMarkRead(alert.id)}
          >
            Dismiss
          </button>
        ) : null}
      </div>
    </article>
  )
}
