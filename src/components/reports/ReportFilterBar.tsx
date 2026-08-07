import { AppDateRangeField } from '@/components/date-picker'

export type ReportDateRange = { from: string; to: string }

export function ReportFilterBar({
  range,
  onRangeChange,
  children,
}: {
  range: ReportDateRange
  onRangeChange: (r: ReportDateRange) => void
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-white p-3">
      <AppDateRangeField
        label="Date range"
        from={range.from}
        to={range.to}
        onChange={({ from, to }) => onRangeChange({ from, to })}
        className="min-w-[14rem]"
      />
      {children}
    </div>
  )
}
