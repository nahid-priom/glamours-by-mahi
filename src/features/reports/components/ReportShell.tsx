import { type ReactNode } from 'react'
import { AppDateRangeField } from '@/components/date-picker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DATE_PRESETS, type DatePresetId, type ReportFilterContract } from '../reports.filters'
import { ReportExportMenu } from './ReportExportMenu'
import { ReportMobileFilters } from './ReportMobileFilters'
import { useReportFilters } from '../hooks/use-report-filters'
import type { ReportRange } from '../repositories/reports.repository'

export function ReportShell({
  title,
  subtitle,
  children,
  onExport,
  onPrint,
  range,
  onRangeChange,
  showRange = true,
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  status,
  onStatusChange,
  statusOptions,
  branchId,
  onBranchChange,
  filterExtras,
  activeFilterCount = 0,
  onClearFilters,
  onApplyPreset,
  filtersForMobile,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  onExport?: () => void
  onPrint?: () => void
  range?: ReportRange
  onRangeChange?: (r: ReportRange) => void
  showRange?: boolean
  search?: string
  onSearchChange?: (v: string) => void
  searchPlaceholder?: string
  status?: string | null
  onStatusChange?: (v: string | null) => void
  statusOptions?: { value: string; label: string }[]
  branchId?: string | null
  onBranchChange?: (v: string | null) => void
  filterExtras?: ReactNode
  activeFilterCount?: number
  onClearFilters?: () => void
  onApplyPreset?: (id: DatePresetId) => void
  filtersForMobile?: ReportFilterContract
}) {
  const mobileFilters: ReportFilterContract =
    filtersForMobile ??
    ({
      from: range?.from ?? '',
      to: range?.to ?? '',
      search: search ?? null,
      status: status ?? null,
      branchId: branchId ?? null,
    } as ReportFilterContract)

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-1 sm:px-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-[#111827]">{title}</h1>
          {subtitle ? <p className="text-sm text-[#6B7280]">{subtitle}</p> : null}
        </div>
        <ReportExportMenu onExportCsv={onExport} onPrint={onPrint} />
      </div>

      {showRange && range && onRangeChange ? (
        <div className="space-y-2 rounded-xl border border-border bg-white p-3">
          <div className="hidden flex-wrap items-end gap-2 md:flex">
            {onApplyPreset
              ? DATE_PRESETS.filter((p) => p.id !== 'custom').map((p) => (
                  <Button
                    key={p.id}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => onApplyPreset(p.id)}
                  >
                    {p.label}
                  </Button>
                ))
              : null}
            <AppDateRangeField
              label="Date range"
              from={range.from}
              to={range.to}
              onChange={({ from, to }) => onRangeChange({ from, to })}
              className="min-w-[14rem] max-w-sm"
            />
            {onSearchChange ? (
              <Input
                value={search ?? ''}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="max-w-xs"
                aria-label="Search"
              />
            ) : null}
            {onStatusChange && statusOptions?.length ? (
              <select
                className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={status ?? ''}
                onChange={(e) => onStatusChange(e.target.value || null)}
                aria-label="Status"
              >
                <option value="">All statuses</option>
                {statusOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : null}
            {onBranchChange ? (
              <Input
                value={branchId ?? ''}
                onChange={(e) => onBranchChange(e.target.value || null)}
                placeholder="Branch ID"
                className="max-w-[12rem]"
                aria-label="Branch"
              />
            ) : null}
            {filterExtras}
            {onClearFilters && activeFilterCount > 0 ? (
              <Button type="button" size="sm" variant="ghost" onClick={onClearFilters}>
                Clear ({activeFilterCount})
              </Button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 md:hidden">
            {onSearchChange ? (
              <Input
                value={search ?? ''}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="min-w-0 flex-1"
                aria-label="Search"
              />
            ) : null}
            {onApplyPreset && onClearFilters ? (
              <ReportMobileFilters
                filters={mobileFilters}
                activeCount={activeFilterCount}
                onChange={(patch) => {
                  if (patch.from != null && patch.to != null) {
                    onRangeChange({ from: patch.from, to: patch.to })
                  }
                  if (patch.search !== undefined && onSearchChange) {
                    onSearchChange(patch.search ?? '')
                  }
                  if (patch.status !== undefined && onStatusChange) {
                    onStatusChange(patch.status)
                  }
                  if (patch.branchId !== undefined && onBranchChange) {
                    onBranchChange(patch.branchId)
                  }
                }}
                onApplyPreset={onApplyPreset}
                onClear={onClearFilters}
                showBranch={Boolean(onBranchChange)}
                showStatus={Boolean(onStatusChange && statusOptions?.length)}
                statusOptions={statusOptions}
                showSearch={Boolean(onSearchChange)}
                searchPlaceholder={searchPlaceholder}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {children}
    </div>
  )
}

export function useReportRange() {
  const { range, setFilters, applyPreset, clearFilters, activeCount, filters } = useReportFilters({
    syncUrl: true,
  })
  return {
    range,
    setRange: (r: ReportRange) => setFilters({ from: r.from, to: r.to }),
    filters,
    setFilters,
    applyPreset,
    clearFilters,
    activeCount,
  }
}
