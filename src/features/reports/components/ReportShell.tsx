import { useState, type ReactNode } from 'react'
import { AppDateRangeField } from '@/components/date-picker'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { Button } from '@/components/ui/button'
import type { ReportRange } from '../repositories/reports.repository'
import { reportsRepository } from '../repositories/reports.repository'

export function ReportShell({
  title,
  subtitle,
  children,
  onExport,
  onPrint,
  range,
  onRangeChange,
  showRange = true,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  onExport?: () => void
  onPrint?: () => void
  range?: ReportRange
  onRangeChange?: (r: ReportRange) => void
  showRange?: boolean
}) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">{title}</h1>
          {subtitle ? <p className="text-sm text-[#6B7280]">{subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {onPrint ? (
            <PermissionGate permission={['reports.print', 'reports.read']}>
              <Button size="sm" variant="outline" onClick={onPrint}>
                Print
              </Button>
            </PermissionGate>
          ) : null}
          {onExport ? (
            <PermissionGate permission={['reports.export', 'reports.read']}>
              <Button size="sm" variant="outline" onClick={onExport}>
                Export CSV
              </Button>
            </PermissionGate>
          ) : null}
        </div>
      </div>
      {showRange && range && onRangeChange ? (
        <AppDateRangeField
          from={range.from}
          to={range.to}
          onChange={({ from, to }) => onRangeChange({ ...range, from, to })}
          className="max-w-sm"
        />
      ) : null}
      {children}
    </div>
  )
}

export function useReportRange() {
  const [range, setRange] = useState(() => reportsRepository.defaultRange())
  return { range, setRange }
}
