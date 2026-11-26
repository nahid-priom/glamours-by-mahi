import { Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { AppDateRangeField } from '@/components/date-picker'
import { DATE_PRESETS, type DatePresetId, type ReportFilterContract } from '../reports.filters'

type Props = {
  filters: ReportFilterContract
  activeCount: number
  onChange: (patch: Partial<ReportFilterContract>) => void
  onApplyPreset: (id: DatePresetId) => void
  onClear: () => void
  showBranch?: boolean
  showStatus?: boolean
  statusOptions?: { value: string; label: string }[]
  showSearch?: boolean
  searchPlaceholder?: string
}

export function ReportMobileFilters({
  filters,
  activeCount,
  onChange,
  onApplyPreset,
  onClear,
  showBranch = false,
  showStatus = false,
  statusOptions = [],
  showSearch = true,
  searchPlaceholder = 'Search…',
}: Props) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 md:hidden">
          <Filter className="h-3.5 w-3.5" />
          Filters
          {activeCount > 0 ? (
            <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
              {activeCount}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Report filters</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {DATE_PRESETS.filter((p) => p.id !== 'custom').map((p) => (
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
            ))}
          </div>
          <AppDateRangeField
            label="Date range"
            from={filters.from}
            to={filters.to}
            onChange={({ from, to }) => onChange({ from, to })}
            className="w-full"
          />
          {showSearch ? (
            <div className="space-y-1.5">
              <Label htmlFor="report-search-mobile">Search</Label>
              <Input
                id="report-search-mobile"
                value={filters.search ?? ''}
                onChange={(e) => onChange({ search: e.target.value || null })}
                placeholder={searchPlaceholder}
              />
            </div>
          ) : null}
          {showBranch ? (
            <div className="space-y-1.5">
              <Label htmlFor="report-branch-mobile">Branch ID</Label>
              <Input
                id="report-branch-mobile"
                value={filters.branchId ?? ''}
                onChange={(e) => onChange({ branchId: e.target.value || null })}
                placeholder="Optional branch UUID"
              />
            </div>
          ) : null}
          {showStatus && statusOptions.length > 0 ? (
            <div className="space-y-1.5">
              <Label htmlFor="report-status-mobile">Status</Label>
              <select
                id="report-status-mobile"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={filters.status ?? ''}
                onChange={(e) => onChange({ status: e.target.value || null })}
              >
                <option value="">All</option>
                {statusOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
        <div className="mt-6 flex flex-row gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClear}>
            Reset
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
