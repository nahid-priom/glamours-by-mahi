import { useCallback } from 'react'
import { Filter, X } from 'lucide-react'
import { EntityCombobox } from '@/components/entity-combobox'
import { SearchInput } from '@/components/shared/SearchInput'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AppDateRangeField } from '@/components/date-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { StockLocation } from '../repositories/inventory.repository'
import { STOCK_MOVEMENT_TYPES, searchVariants } from '../repositories/inventory.repository'

export type StockLedgerUiFilters = {
  variantId: string | null
  variantLabel: string | null
  locationId: string | null
  movementTypes: string[]
  search: string
  fromDate: string
  toDate: string
}

type Props = {
  filters: StockLedgerUiFilters
  locations: StockLocation[]
  onChange: (patch: Partial<StockLedgerUiFilters>) => void
  onClear: () => void
  activeCount: number
}

const MOVEMENT_LABELS: Record<string, string> = {
  opening: 'Opening',
  purchase: 'Purchase',
  purchase_return: 'Purchase return',
  sale: 'Sale',
  sale_return: 'Sale return',
  adjustment: 'Adjustment',
  transfer_out: 'Transfer out',
  transfer_in: 'Transfer in',
  damage: 'Damage',
  quarantine: 'Quarantine',
  correction: 'Correction',
}

export function StockLedgerFilterBar({
  filters,
  locations,
  onChange,
  onClear,
  activeCount,
}: Props) {
  const onSearchVariants = useCallback((q: string) => searchVariants(q), [])

  const movementLabel =
    filters.movementTypes.length === 0
      ? 'All types'
      : filters.movementTypes.length === 1
        ? (MOVEMENT_LABELS[filters.movementTypes[0]] ?? filters.movementTypes[0])
        : `${filters.movementTypes.length} types`

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-white p-3">
      <div className="min-w-[14rem] flex-1 basis-[14rem]">
        <p className="mb-1 text-xs font-medium text-[#6B7280]">Product / variant</p>
        <EntityCombobox
          value={filters.variantId}
          onChange={(id, opt) =>
            onChange({
              variantId: id,
              variantLabel: opt?.label
                ? `${opt.description ? `${opt.description} · ` : ''}${opt.label}`
                : null,
            })
          }
          onSearch={onSearchVariants}
          placeholder="Search SKU or variant…"
          emptyMessage="No variants found"
          aria-label="Product variant"
        />
      </div>

      <div className="min-w-[10rem] flex-1 basis-[10rem]">
        <p className="mb-1 text-xs font-medium text-[#6B7280]">Search</p>
        <SearchInput
          value={filters.search}
          onChange={(search) => onChange({ search })}
          placeholder="SKU, barcode, name…"
          inputClassName="h-9"
        />
      </div>

      <div className="w-[10rem]">
        <p className="mb-1 text-xs font-medium text-[#6B7280]">Location</p>
        <Select
          value={filters.locationId ?? 'all'}
          onValueChange={(v) => onChange({ locationId: v === 'all' ? null : v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="All locations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All locations</SelectItem>
            {locations.map((loc) => (
              <SelectItem key={loc.id} value={loc.id}>
                {loc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-[10rem]">
        <p className="mb-1 text-xs font-medium text-[#6B7280]">Movement</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" className="h-9 w-full justify-between font-normal">
              <span className="flex items-center gap-1.5 truncate">
                <Filter className="h-3.5 w-3.5 shrink-0 opacity-50" />
                <span className="truncate">{movementLabel}</span>
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Movement types</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {STOCK_MOVEMENT_TYPES.map((type) => {
              const checked = filters.movementTypes.includes(type)
              return (
                <DropdownMenuCheckboxItem
                  key={type}
                  checked={checked}
                  onCheckedChange={(next) => {
                    const movementTypes = next
                      ? [...filters.movementTypes, type]
                      : filters.movementTypes.filter((t) => t !== type)
                    onChange({ movementTypes })
                  }}
                  onSelect={(e) => e.preventDefault()}
                >
                  {MOVEMENT_LABELS[type] ?? type}
                </DropdownMenuCheckboxItem>
              )
            })}
            {filters.movementTypes.length > 0 ? (
              <>
                <DropdownMenuSeparator />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-full justify-start text-xs"
                  onClick={() => onChange({ movementTypes: [] })}
                >
                  Clear types
                </Button>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AppDateRangeField
        label="Date range"
        from={filters.fromDate}
        to={filters.toDate}
        onChange={({ from, to }) => onChange({ fromDate: from, toDate: to })}
        className="min-w-[14rem]"
      />

      {activeCount > 0 ? (
        <Button type="button" variant="ghost" size="sm" className="h-9 gap-1" onClick={onClear}>
          <X className="h-3.5 w-3.5" />
          Clear ({activeCount})
        </Button>
      ) : null}
    </div>
  )
}
