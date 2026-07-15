import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import type { ReportRange } from '../repositories/reports.repository'
import { reportsRepository } from '../repositories/reports.repository'

export function ReportShell({
  title,
  subtitle,
  children,
  onExport,
  range,
  onRangeChange,
  showRange = true,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  onExport?: () => void
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
        {onExport ? (
          <Button size="sm" variant="outline" onClick={onExport}>
            Export CSV
          </Button>
        ) : null}
      </div>
      {showRange && range && onRangeChange ? (
        <div className="flex flex-wrap gap-2">
          <input
            type="date"
            className="h-9 rounded-md border border-border bg-white px-2 text-sm"
            value={range.from}
            onChange={(e) => onRangeChange({ ...range, from: e.target.value })}
          />
          <input
            type="date"
            className="h-9 rounded-md border border-border bg-white px-2 text-sm"
            value={range.to}
            onChange={(e) => onRangeChange({ ...range, to: e.target.value })}
          />
        </div>
      ) : null}
      {children}
    </div>
  )
}

export function useReportRange() {
  const [range, setRange] = useState(() => reportsRepository.defaultRange())
  return { range, setRange }
}
