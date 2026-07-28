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
import { cn } from '@/lib/utils'
import {
  SORT_OPTIONS,
  STATUS_OPTIONS,
  STOCK_CHIP_OPTIONS,
  clearProductCatalogFilters,
  type ProductCatalogFilters,
} from '../lib/product-filters'
import { countActiveFilters } from '../lib/product-list-model'
import { searchBrands, searchCategories } from '../repositories/catalog.repository'

type Props = {
  value: ProductCatalogFilters
  onChange: (next: ProductCatalogFilters) => void
  className?: string
  hideCategoryFilter?: boolean
}

function AdvancedFilters({
  value,
  onChange,
  layout,
  hideCategoryFilter,
}: {
  value: ProductCatalogFilters
  onChange: (next: ProductCatalogFilters) => void
  layout: 'inline' | 'sheet'
  hideCategoryFilter?: boolean
}) {
  const set = (patch: Partial<ProductCatalogFilters>) => {
    onChange({ ...value, ...patch, page: patch.page ?? 1 })
  }

  const fieldClass = layout === 'sheet' ? 'w-full' : 'w-full sm:w-[180px]'

  return (
    <div className={cn('flex flex-col gap-3', layout === 'inline' && 'sm:flex-row sm:flex-wrap')}>
      {!hideCategoryFilter ? (
        <EntityCombobox
          value={value.category ?? null}
          onChange={(id) => set({ category: id, page: 1 })}
          onSearch={searchCategories}
          placeholder="Category"
          aria-label="Category filter"
          className={fieldClass}
        />
      ) : null}
      <EntityCombobox
        value={value.brand ?? null}
        onChange={(id) => set({ brand: id, page: 1 })}
        onSearch={searchBrands}
        placeholder="Brand"
        aria-label="Brand filter"
        className={fieldClass}
      />
      <Select
        value={value.status ?? 'all'}
        onValueChange={(v) => set({ status: v as ProductCatalogFilters['status'], page: 1 })}
      >
        <SelectTrigger className={cn('h-11', fieldClass)}>
          <SelectValue placeholder="Lifecycle" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={value.sort ?? 'name_asc'}
        onValueChange={(v) => set({ sort: v as ProductCatalogFilters['sort'], page: 1 })}
      >
        <SelectTrigger className={cn('h-11', fieldClass)}>
          <SelectValue placeholder="Sort" />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function ProductFilterBar({ value, onChange, className, hideCategoryFilter }: Props) {
  const [searchDraft, setSearchDraft] = useState(value.q ?? '')
  const [sheetOpen, setSheetOpen] = useState(false)
  const activeFilters = countActiveFilters(value)

  useEffect(() => {
    setSearchDraft(value.q ?? '')
  }, [value.q])

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchDraft !== (value.q ?? '')) {
        onChange({ ...value, q: searchDraft, page: 1 })
      }
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce search only
  }, [searchDraft])

  const set = (patch: Partial<ProductCatalogFilters>) => {
    onChange({ ...value, ...patch, page: patch.page ?? 1 })
  }

  const clearFilters = () => {
    onChange(clearProductCatalogFilters())
    setSearchDraft('')
  }

  return (
    <div className={cn('space-y-3 rounded-xl border border-border bg-white p-3 sm:p-4', className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <SearchInput
            value={searchDraft}
            onChange={setSearchDraft}
            placeholder="Search name, SKU, barcode…"
          />
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <AdvancedFilters value={value} onChange={onChange} layout="inline" hideCategoryFilter={hideCategoryFilter} />
          {activeFilters > 0 ? (
            <Button size="sm" variant="ghost" onClick={clearFilters}>
              <X className="mr-1 h-4 w-4" />
              Clear
            </Button>
          ) : null}
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button size="sm" variant="outline" className="h-11 min-w-[44px] flex-1">
                <SlidersHorizontal className="mr-1.5 h-4 w-4" />
                Filters
                {activeFilters > 0 ? (
                  <span className="ml-1.5 rounded-full bg-[#111111] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {activeFilters}
                  </span>
                ) : null}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
              <SheetHeader>
                <SheetTitle>Filter products</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <AdvancedFilters value={value} onChange={onChange} layout="sheet" hideCategoryFilter={hideCategoryFilter} />
                <div className="flex flex-wrap gap-2">
                  {STOCK_CHIP_OPTIONS.map((chip) => {
                    const active = (value.stock ?? 'all') === chip.value
                    return (
                      <button
                        key={chip.value}
                        type="button"
                        onClick={() => set({ stock: chip.value, page: 1 })}
                        className={cn(
                          'rounded-full px-3 py-2 text-xs font-medium transition-colors',
                          active
                            ? 'bg-[#111111] text-white'
                            : 'bg-slate-100 text-[#6B7280]',
                        )}
                      >
                        {chip.label}
                      </button>
                    )
                  })}
                </div>
                <div className="flex gap-2">
                  {activeFilters > 0 ? (
                    <Button variant="outline" className="flex-1" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : null}
                  <SheetClose asChild>
                    <Button className="flex-1">Apply</Button>
                  </SheetClose>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="hidden flex-wrap gap-2 lg:flex">
        {STOCK_CHIP_OPTIONS.map((chip) => {
          const active = (value.stock ?? 'all') === chip.value
          return (
            <button
              key={chip.value}
              type="button"
              onClick={() => set({ stock: chip.value, page: 1 })}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                active
                  ? 'bg-[#111111] text-white'
                  : 'bg-slate-100 text-[#6B7280] hover:bg-rose-50 hover:text-[#E11D48]',
              )}
            >
              {chip.label}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-2 lg:hidden">
        {STOCK_CHIP_OPTIONS.filter((chip) => (value.stock ?? 'all') === chip.value && chip.value !== 'all').map(
          (chip) => (
            <span
              key={chip.value}
              className="rounded-full bg-[#111111] px-3 py-1 text-xs font-medium text-white"
            >
              {chip.label}
            </span>
          ),
        )}
      </div>
    </div>
  )
}
