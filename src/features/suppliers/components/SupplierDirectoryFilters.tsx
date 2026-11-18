import { LayoutGrid, LayoutList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { SupplierDirectoryViewMode } from '../types/supplier-360.types'

export type SupplierSortKey = 'name' | 'due' | 'activity' | 'purchased' | 'paid'

type Props = {
  search: string
  onSearchChange: (value: string) => void
  status: string
  onStatusChange: (value: string) => void
  dueOnly: boolean
  onDueOnlyChange: (value: boolean) => void
  sortBy: SupplierSortKey
  onSortByChange: (value: SupplierSortKey) => void
  viewMode: SupplierDirectoryViewMode
  onViewModeChange: (value: SupplierDirectoryViewMode) => void
}

const sortOptions: { value: SupplierSortKey; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'due', label: 'Current due' },
  { value: 'activity', label: 'Last activity' },
  { value: 'purchased', label: 'Purchases' },
  { value: 'paid', label: 'Paid total' },
]

export function SupplierDirectoryFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  dueOnly,
  onDueOnlyChange,
  sortBy,
  onSortByChange,
  viewMode,
  onViewModeChange,
}: Props) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-white p-3 sm:flex-row sm:flex-wrap sm:items-center">
      <Input
        placeholder="Search name, phone, email…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="h-9 sm:max-w-xs"
        aria-label="Search suppliers"
      />
      <select
        className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
        aria-label="Filter by status"
      >
        <option value="">All statuses</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
      <select
        className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
        value={sortBy}
        onChange={(e) => onSortByChange(e.target.value as SupplierSortKey)}
        aria-label="Sort suppliers"
      >
        {sortOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            Sort: {opt.label}
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="sm"
        variant={dueOnly ? 'default' : 'outline'}
        onClick={() => onDueOnlyChange(!dueOnly)}
        aria-pressed={dueOnly}
      >
        Due only
      </Button>
      <div className="ml-auto flex gap-1">
        <Button
          type="button"
          size="icon"
          variant={viewMode === 'cards' ? 'default' : 'outline'}
          onClick={() => onViewModeChange('cards')}
          aria-label="Card view"
          aria-pressed={viewMode === 'cards'}
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant={viewMode === 'table' ? 'default' : 'outline'}
          onClick={() => onViewModeChange('table')}
          aria-label="Table view"
          aria-pressed={viewMode === 'table'}
        >
          <LayoutList className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}