import type { FraudLevel } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { FraudRiskBadge } from '@/features/fraud/FraudRiskBadge'
import { isFraudLevel } from '@/features/reports/report-cell.utils'
import type { ReportCellData } from '@/features/reports/reports.types'

export interface GroupedReportCellProps extends ReportCellData {
  variant?: 'stack' | 'inline' | 'print'
  className?: string
}

export function GroupedReportCell({
  title,
  subtitle,
  extra,
  status,
  tooltip,
  variant = 'stack',
  className,
}: GroupedReportCellProps) {
  const showFraudBadge = status && isFraudLevel(status)
  const showTitle = Boolean(title) && !(showFraudBadge && title === status)
  const hasContent = showTitle || subtitle || extra || status

  if (!hasContent) {
    return <span className={cn('text-text-muted', className)}>—</span>
  }

  if (variant === 'inline') {
    return (
      <div className={cn('text-right', className)}>
        {showTitle && <div className="font-medium text-text">{title}</div>}
        {subtitle && <div className="text-xs text-text-muted">{subtitle}</div>}
        {extra && <div className="text-xs text-text-muted">{extra}</div>}
        {status && !showFraudBadge && (
          <div className="text-xs font-medium capitalize text-text">{status}</div>
        )}
        {showFraudBadge && (
          <div className={cn(showTitle || subtitle || extra ? 'mt-1 flex justify-end' : 'flex justify-end')}>
            <FraudRiskBadge level={status as FraudLevel} />
          </div>
        )}
      </div>
    )
  }

  if (variant === 'print') {
    return (
      <div className={cn('report-cell', className)} title={tooltip}>
        {showTitle && <div className="report-cell-title">{title}</div>}
        {showFraudBadge && <div className="report-cell-status">{status}</div>}
        {subtitle && <div className="report-cell-sub">{subtitle}</div>}
        {extra && <div className="report-cell-sub">{extra}</div>}
        {status && !showFraudBadge && <div className="report-cell-status">{status}</div>}
      </div>
    )
  }

  return (
    <div className={cn('space-y-1', className)} title={tooltip}>
      {showTitle && <div className="font-medium text-sm text-text">{title}</div>}
      {showFraudBadge && <FraudRiskBadge level={status as FraudLevel} className="text-[10px]" />}
      {subtitle && <div className="text-xs text-text-muted">{subtitle}</div>}
      {extra && <div className="text-xs text-text-muted">{extra}</div>}
      {status && !showFraudBadge && (
        <div className="text-xs font-medium capitalize text-text">{status}</div>
      )}
    </div>
  )
}
