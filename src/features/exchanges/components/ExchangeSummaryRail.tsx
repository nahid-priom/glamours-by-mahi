import { formatBDT } from '@/lib/format'
import { cn } from '@/lib/utils'

type Props = {
  returnTotal: number
  replacementTotal: number
  difference: number
  returnCount?: number
  replacementCount?: number
  footer?: React.ReactNode
  className?: string
}

export function differenceLabel(difference: number) {
  if (difference > 0) return 'Customer pays'
  if (difference < 0) return 'Refund'
  return 'Even'
}

export function ExchangeSummaryRail({
  returnTotal,
  replacementTotal,
  difference,
  returnCount = 0,
  replacementCount = 0,
  footer,
  className,
}: Props) {
  const absDiff = Math.abs(difference)
  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col rounded-2xl border border-border bg-white p-3',
        className,
      )}
    >
      <p className="text-sm font-semibold text-text-primary">Summary</p>
      <div className="mt-3 space-y-2 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-text-muted">
            Returns{returnCount ? ` (${returnCount})` : ''}
          </span>
          <span className="font-medium tabular-nums">{formatBDT(returnTotal)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-text-muted">
            Replacements{replacementCount ? ` (${replacementCount})` : ''}
          </span>
          <span className="font-medium tabular-nums">{formatBDT(replacementTotal)}</span>
        </div>
      </div>

      <div
        className={cn(
          'mt-4 rounded-xl border px-3 py-3',
          difference > 0 && 'border-primary/30 bg-primary/5',
          difference < 0 && 'border-success/30 bg-success/5',
          difference === 0 && 'border-border bg-slate-50',
        )}
      >
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
          {differenceLabel(difference)}
        </p>
        <p
          className={cn(
            'mt-0.5 text-xl font-bold tabular-nums',
            difference > 0 && 'text-primary',
            difference < 0 && 'text-success',
            difference === 0 && 'text-text-primary',
          )}
        >
          {formatBDT(absDiff)}
        </p>
      </div>

      {footer ? <div className="mt-auto space-y-2 border-t border-border pt-3">{footer}</div> : null}
    </div>
  )
}
