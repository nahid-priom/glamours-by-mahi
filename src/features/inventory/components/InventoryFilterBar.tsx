import { useEffect, useState } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { EntityCombobox } from '@/components/entity-combobox'
import { SearchInput } from '@/components/shared/SearchInput'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { searchBrands, searchCategories } from '@/features/products/repositories/catalog.repository'
import { searchSuppliers } from '@/features/suppliers/repositories/suppliers.repository'
import type { AccessibleBranch } from '../repositories/inventory-valuation.repository'
import {
  SORT_OPTIONS,
  clearInventoryFilters,
  countActiveInventoryFilters,
  statusOptionsForView,
  type InventoryPageFilters,
} from '../lib/inventory-filters'

type Props = {
  filters: InventoryPageFilters
  branches: AccessibleBranch[]
  headOfficeId: string | null
  onChange: (patch: Partial<InventoryPageFilters>) => void
  onClear: () => void
}

function branchSelectValue(filters: InventoryPageFilters, headOfficeId: string | null) {
  if (!filters.branchId) return 'all'
  if (headOfficeId && filters.branchId === headOfficeId) return 'ho'
  return filters.branchId
}

export function InventoryFilterBar({
  filters,
  branches,
  headOfficeId,
  onChange,
  onClear,
}: Props) {
  const [searchDraft, setSearchDraft] = useState(filters.search ?? '')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const activeCount = countActiveInventoryFilters(filters)

  useEffect(() => {
    setSearchDraft(filters.search ?? '')
  }, [filters.search])

  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchDraft.trim()
      if (trimmed !== (filters.search ?? '')) {
        onChange({ search: trimmed || undefined, page: 1 })
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchDraft, filters.search, onChange])

  const setBranch = (value: string) => {
    if (value === 'all') onChange({ branchId: null, page: 1 })
    else if (value === 'ho' && headOfficeId) onChange({ branchId: headOfficeId, page: 1 })
    else onChange({ branchId: value, page: 1 })
  }

  const statusOptions = statusOptionsForView(filters.view)
  const statusValue = filters.stockStatus ?? 'all'
  const statusEnabled = statusOptions.length > 1

  const primaryFilters = (
    <>
      <Select value={branchSelectValue(filters, headOfficeId)} onValueChange={setBranch}>
        <SelectTrigger className="h-10 w-full lg:w-[200px]">
          <SelectValue placeholder="Branch" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Accessible Branches</SelectItem>
          {headOfficeId ? <SelectItem value="ho">Head Office</SelectItem> : null}
          {branches.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {b.name}
              {b.code ? ` (${b.code})` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={statusValue}
        disabled={!statusEnabled}
        onValueChange={(v) =>
          onChange({
            stockStatus: v === 'all' ? null : (v as InventoryPageFilters['stockStatus']),
            includeNonSaleable:
              v === 'damaged' ||
              v === 'quarantine' ||
              filters.includeDamaged ||
              filters.includeQuarantine,
            includeDamaged: v === 'damaged' ? true : filters.includeDamaged,
            includeQuarantine: v === 'quarantine' ? true : filters.includeQuarantine,
            page: 1,
          })
        }
      >
        <SelectTrigger className="h-10 w-full lg:w-[160px]">
          <SelectValue placeholder="Stock Status" />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <EntityCombobox
        value={filters.categoryId ?? null}
        onChange={(id) => onChange({ categoryId: id, page: 1 })}
        onSearch={searchCategories}
        placeholder="Category"
        aria-label="Category filter"
        className="w-full lg:w-[160px]"
      />
      {filters.view === 'suppliers' ? (
        <EntityCombobox
          value={filters.supplierId ?? null}
          onChange={(id) => onChange({ supplierId: id, page: 1 })}
          onSearch={searchSuppliers}
          placeholder="Supplier"
          aria-label="Supplier filter"
          className="w-full lg:w-[180px]"
        />
      ) : null}
    </>
  )

  const advancedFilters = (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <EntityCombobox
        value={filters.brandId ?? null}
        onChange={(id) => onChange({ brandId: id, page: 1 })}
        onSearch={searchBrands}
        placeholder="Brand"
        aria-label="Brand filter"
        className="w-full"
      />
      {filters.view === 'suppliers' ? (
        <Select
          value={filters.sourceStatus ?? 'all'}
          onValueChange={(v) =>
            onChange({
              sourceStatus:
                v === 'all'
                  ? null
                  : (v as InventoryPageFilters['sourceStatus']),
              page: 1,
            })
          }
        >
          <SelectTrigger className="h-10 w-full">
            <SelectValue placeholder="Traceability" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Traceability</SelectItem>
            <SelectItem value="system_allocated">System Allocated</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="unknown_legacy">Unknown Legacy</SelectItem>
          </SelectContent>
        </Select>
      ) : null}
      <Select
        value={filters.sortBy}
        onValueChange={(v) => onChange({ sortBy: v as InventoryPageFilters['sortBy'], page: 1 })}
      >
        <SelectTrigger className="h-10 w-full">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <label className="flex items-center gap-2 text-sm text-[#374151]">
        <input
          type="checkbox"
          checked={filters.includeDamaged}
          onChange={(e) =>
            onChange({
              includeDamaged: e.target.checked,
              includeNonSaleable: e.target.checked || filters.includeQuarantine,
              page: 1,
            })
          }
          className="h-4 w-4 accent-[#111827]"
        />
        Include Damaged Stock
      </label>
      <label className="flex items-center gap-2 text-sm text-[#374151]">
        <input
          type="checkbox"
          checked={filters.includeQuarantine}
          onChange={(e) =>
            onChange({
              includeQuarantine: e.target.checked,
              includeNonSaleable: e.target.checked || filters.includeDamaged,
              page: 1,
            })
          }
          className="h-4 w-4 accent-[#111827]"
        />
        Include Quarantine Stock
      </label>
    </div>
  )

  return (
    <div className="space-y-3 rounded-xl border border-border bg-white p-3 sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <SearchInput
            value={searchDraft}
            onChange={setSearchDraft}
            placeholder="Search by product, variant, SKU or barcode"
          />
        </div>
        <div className="hidden flex-wrap items-center gap-2 lg:flex">{primaryFilters}</div>
        <div className="hidden items-center gap-2 lg:flex">
          <Button
            size="sm"
            variant="outline"
            className="h-10"
            onClick={() => setAdvancedOpen((v) => !v)}
          >
            <SlidersHorizontal className="mr-1.5 h-4 w-4" />
            More Filters
          </Button>
          {activeCount > 0 ? (
            <Button size="sm" variant="ghost" className="h-10" onClick={onClear}>
              <X className="mr-1 h-4 w-4" />
              Reset
            </Button>
          ) : null}
        </div>
        <div className="lg:hidden">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="h-11 w-full">
                <SlidersHorizontal className="mr-1.5 h-4 w-4" />
                Filters
                {activeCount > 0 ? (
                  <span className="ml-1.5 rounded-full bg-[#111827] px-1.5 py-0.5 text-[10px] text-white">
                    {activeCount}
                  </span>
                ) : null}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
              <SheetHeader>
                <SheetTitle>Inventory filters</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="grid gap-3">{primaryFilters}</div>
                {advancedFilters}
                <div className="sticky bottom-0 flex gap-2 bg-white pt-2">
                  <Button variant="outline" className="flex-1" onClick={onClear}>
                    Clear
                  </Button>
                  <SheetClose asChild>
                    <Button className="flex-1">Apply</Button>
                  </SheetClose>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {advancedOpen ? <div className="hidden lg:block">{advancedFilters}</div> : null}

      {activeCount > 0 ? (
        <p className="text-xs text-[#6B7280]">{activeCount} active filter{activeCount === 1 ? '' : 's'}</p>
      ) : null}
    </div>
  )
}

export { clearInventoryFilters }
