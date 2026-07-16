import { useEffect, useState } from 'react'
import { EntityCombobox } from '@/components/entity-combobox'
import { SearchInput } from '@/components/shared/SearchInput'
import { cn } from '@/lib/utils'
import {
  STATUS_OPTIONS,
  STOCK_CHIP_OPTIONS,
  type ProductCatalogFilters,
} from '../lib/product-filters'
import { searchBrands, searchCategories } from '../repositories/catalog.repository'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Props = {
  value: ProductCatalogFilters
  onChange: (next: ProductCatalogFilters) => void
  className?: string
}

export function ProductFilterBar({ value, onChange, className }: Props) {
  const [searchDraft, setSearchDraft] = useState(value.q ?? '')

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
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <EntityCombobox
            value={value.category ?? null}
            onChange={(id) => set({ category: id, page: 1 })}
            onSearch={searchCategories}
            placeholder="Category"
            aria-label="Category filter"
            className="w-full sm:w-[180px]"
          />
          <EntityCombobox
            value={value.brand ?? null}
            onChange={(id) => set({ brand: id, page: 1 })}
            onSearch={searchBrands}
            placeholder="Brand"
            aria-label="Brand filter"
            className="w-full sm:w-[180px]"
          />
          <Select
            value={value.status ?? 'all'}
            onValueChange={(v) => set({ status: v as ProductCatalogFilters['status'], page: 1 })}
          >
            <SelectTrigger className="h-11 w-full sm:w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
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
    </div>
  )
}
