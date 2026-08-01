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
      <label className="text-xs text-[#6B7280]">
        From
        <input
          type="date"
          className="mt-1 block h-9 rounded-md border border-border bg-white px-2 text-sm"
          value={range.from}
          onChange={(e) => onRangeChange({ ...range, from: e.target.value })}
        />
      </label>
      <label className="text-xs text-[#6B7280]">
        To
        <input
          type="date"
          className="mt-1 block h-9 rounded-md border border-border bg-white px-2 text-sm"
          value={range.to}
          onChange={(e) => onRangeChange({ ...range, to: e.target.value })}
        />
      </label>
      {children}
    </div>
  )
}
