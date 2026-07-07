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
import { MOCK_COURIERS, MOCK_STORES } from '@/lib/mock-data'

const selectTriggerClass =
  'h-11 w-full min-w-0 sm:w-[calc(50%-0.375rem)] lg:w-[128px] xl:w-[150px] 2xl:w-[180px]'

interface OrderFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  store: string
  courier: string
  fraud: string
  showDeleted: boolean
  onStoreChange: (v: string) => void
  onCourierChange: (v: string) => void
  onFraudChange: (v: string) => void
  onShowDeletedChange: (v: boolean) => void
}

export function OrderFilters({
  search,
  onSearchChange,
  store,
  courier,
  fraud,
  showDeleted,
  onStoreChange,
  onCourierChange,
  onFraudChange,
  onShowDeletedChange,
}: OrderFiltersProps) {
  return (
    <Card className="rounded-2xl border bg-white shadow-sm">
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="w-full min-w-0 lg:basis-1/2 lg:max-w-[50%]">
            <SearchInput
              value={search}
              onChange={onSearchChange}
              placeholder="Search orders, customers, phone..."
            />
          </div>

          <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:basis-1/2 lg:max-w-[50%] lg:flex-nowrap lg:justify-end">
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

            <Select value={courier} onValueChange={onCourierChange}>
              <SelectTrigger className={selectTriggerClass}>
                <SelectValue placeholder="Courier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Couriers</SelectItem>
                {MOCK_COURIERS.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={fraud} onValueChange={onFraudChange}>
              <SelectTrigger className={selectTriggerClass}>
                <SelectValue placeholder="Fraud Risk" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risk Levels</SelectItem>
                <SelectItem value="SAFE">Safe</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="BLOCKED">Blocked</SelectItem>
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
