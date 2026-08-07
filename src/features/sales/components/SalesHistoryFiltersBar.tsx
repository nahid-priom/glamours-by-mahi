import { useCallback, useEffect, useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { AppDateRangeField } from '@/components/date-picker'
import { EntityCombobox } from '@/components/entity-combobox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useAuth } from '@/features/auth/auth-session'
import { queryKeys } from '@/lib/query/keys'
import {
  listPaymentMethods,
  searchBranches,
  searchCashiers,
  searchCategories,
} from '../repositories/sales.repository'
import { resolvePresetRange } from '../schemas/sale-filters.schema'
import type { SalesDatePreset, SalesHistoryFilters, SalesSort } from '../types/sale.types'

const PRESETS: Array<{ value: SalesDatePreset; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This Week' },
  { value: 'last_7', label: 'Last 7 Days' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'custom', label: 'Custom' },
  { value: 'all', label: 'All Time' },
]

const PAYMENT_STATUS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All Payments' },
  { value: 'paid', label: 'Paid' },
  { value: 'partial', label: 'Partially Paid' },
  { value: 'unpaid', label: 'Due' },
]

export function SalesHistoryFiltersBar({
  filters,
  onChange,
  onClear,
}: {
  filters: SalesHistoryFilters
  onChange: (next: SalesHistoryFilters) => void
  onClear: () => void
}) {
  const { activeBranchId } = useAuth()
  const [moreOpen, setMoreOpen] = useState(false)
  const [searchDraft, setSearchDraft] = useState(filters.search)

  const methodsQuery = useQuery({
    queryKey: queryKeys.paymentMethods,
    queryFn: listPaymentMethods,
  })

  const patch = useCallback(
    (partial: Partial<SalesHistoryFilters>) => {
      const next = { ...filters, ...partial, page: partial.page ?? 1 }
      if (partial.preset) {
        const range = resolvePresetRange(partial.preset, next.fromDate, next.toDate)
        next.fromDate = range.fromDate
        next.toDate = range.toDate
      }
      onChange(next)
    },
    [filters, onChange],
  )

  useEffect(() => {
    setSearchDraft(filters.search)
  }, [filters.search])

  useEffect(() => {
    if (searchDraft === filters.search) return
    const t = setTimeout(() => patch({ search: searchDraft }), 350)
    return () => clearTimeout(t)
  }, [searchDraft, filters.search, patch])

  const advancedCount =
    (filters.cashierId ? 1 : 0) +
    (filters.status ? 1 : 0) +
    (filters.paymentMethod ? 1 : 0) +
    (filters.categoryId ? 1 : 0) +
    (filters.dueOnly ? 1 : 0) +
    (filters.sort !== 'date_desc' ? 1 : 0) +
    (filters.branchId && filters.branchId !== activeBranchId ? 1 : 0)

  const anyActive =
    Boolean(filters.search.trim()) ||
    filters.preset !== 'this_month' ||
    Boolean(filters.paymentStatus) ||
    advancedCount > 0

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <Input
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          placeholder="Search by invoice, customer or mobile"
          aria-label="Search sales"
          className="h-9 pl-9"
        />
      </div>

      <select
        className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
        value={filters.preset}
        onChange={(e) => patch({ preset: e.target.value as SalesDatePreset })}
        aria-label="Date"
      >
        {PRESETS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>

      {filters.preset === 'custom' ? (
        <AppDateRangeField
          from={filters.fromDate ?? ''}
          to={filters.toDate ?? ''}
          onChange={({ from, to }) =>
            patch({ fromDate: from || null, toDate: to || null, preset: 'custom' })
          }
          className="min-w-[14rem]"
          allowModeToggle
        />
      ) : null}

      <select
        className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
        value={filters.paymentStatus ?? ''}
        onChange={(e) => patch({ paymentStatus: e.target.value || null })}
        aria-label="Payment status"
      >
        {PAYMENT_STATUS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <Button type="button" size="sm" variant="outline" onClick={() => setMoreOpen(true)}>
        <SlidersHorizontal className="h-3.5 w-3.5" />
        More Filters{advancedCount > 0 ? ` (${advancedCount})` : ''}
      </Button>

      {anyActive ? (
        <Button type="button" size="sm" variant="ghost" onClick={onClear}>
          <X className="h-3.5 w-3.5" />
          Clear All
        </Button>
      ) : null}

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="right" className="w-full max-w-sm overflow-y-auto">
          <SheetHeader>
            <SheetTitle>More Filters</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 p-1 pt-4">
            <div className="space-y-1.5">
              <Label>Branch</Label>
              <EntityCombobox
                value={filters.branchId}
                onChange={(id) => patch({ branchId: id })}
                onSearch={searchBranches}
                placeholder="All Branches"
                allowClear
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cashier</Label>
              <EntityCombobox
                value={filters.cashierId}
                onChange={(id) => patch({ cashierId: id })}
                onSearch={searchCashiers}
                placeholder="All Cashiers"
                allowClear
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sale Status</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={filters.status ?? ''}
                onChange={(e) => patch({ status: e.target.value || null })}
              >
                <option value="">All</option>
                <option value="completed">Completed</option>
                <option value="voided">Voided</option>
                <option value="corrected">Corrected</option>
                <option value="draft">Draft</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Payment Method</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={filters.paymentMethod ?? ''}
                onChange={(e) => patch({ paymentMethod: e.target.value || null })}
              >
                <option value="">All</option>
                {(methodsQuery.data ?? []).map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Product Category</Label>
              <EntityCombobox
                value={filters.categoryId}
                onChange={(id) => patch({ categoryId: id })}
                onSearch={searchCategories}
                placeholder="All Categories"
                allowClear
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filters.dueOnly}
                onChange={(e) => patch({ dueOnly: e.target.checked })}
              />
              Due Invoices Only
            </label>
            <div className="space-y-1.5">
              <Label>Sort By</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={filters.sort}
                onChange={(e) => patch({ sort: e.target.value as SalesSort })}
              >
                <option value="date_desc">Newest First</option>
                <option value="date_asc">Oldest First</option>
                <option value="total_desc">Highest Total First</option>
                <option value="total_asc">Lowest Total First</option>
                <option value="invoice_asc">Invoice A–Z</option>
                <option value="invoice_desc">Invoice Z–A</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  onClear()
                  setMoreOpen(false)
                }}
              >
                Reset
              </Button>
              <Button type="button" className="flex-1" onClick={() => setMoreOpen(false)}>
                Apply Filters
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
