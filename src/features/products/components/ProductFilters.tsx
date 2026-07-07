import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { SearchInput } from '@/components/shared/SearchInput'
import { MOCK_STORES } from '@/lib/mock-data'
import type { ProductStatus } from '../products.types'

const selectTriggerClass = 'h-11 w-full sm:w-[180px]'

interface ProductFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  store: string
  status: ProductStatus | 'all'
  showDeleted: boolean
  onStoreChange: (v: string) => void
  onStatusChange: (v: ProductStatus | 'all') => void
  onShowDeletedChange: (v: boolean) => void
}

export function ProductFiltersBar({
  search,
  onSearchChange,
  store,
  status,
  showDeleted,
  onStoreChange,
  onStatusChange,
  onShowDeletedChange,
}: ProductFiltersProps) {
  return (
    <Card className="rounded-2xl border bg-white shadow-sm">
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="w-full min-w-0 lg:basis-1/2 lg:max-w-[50%]">
            <SearchInput
              value={search}
              onChange={onSearchChange}
              placeholder="Search by name or SKU..."
            />
          </div>

          <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center lg:basis-1/2 lg:max-w-[50%] lg:justify-end">
            <Select value={store} onValueChange={onStoreChange}>
              <SelectTrigger className={selectTriggerClass}>
                <SelectValue placeholder="Store" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stores</SelectItem>
                {MOCK_STORES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={status} onValueChange={(v) => onStatusChange(v as ProductStatus | 'all')}>
              <SelectTrigger className={selectTriggerClass}>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="out_of_stock">Out of Stock</SelectItem>
              </SelectContent>
            </Select>

            <label className="flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-1 text-sm text-slate-600">
              <Checkbox
                checked={showDeleted}
                onCheckedChange={(checked) => onShowDeletedChange(checked === true)}
              />
              Show archived
            </label>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
