import { AppDateRangeField } from '@/components/date-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MOCK_COURIERS, MOCK_STORES } from '@/lib/mock-data'
import { ORDER_STATUSES } from '@/lib/constants'
import type { ReportFilters } from '../reports.types'

interface ReportFiltersProps {
  filters: ReportFilters
  onChange: (filters: ReportFilters) => void
}

export function ReportFiltersPanel({ filters, onChange }: ReportFiltersProps) {
  const set = (patch: Partial<ReportFilters>) => onChange({ ...filters, ...patch })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Report Filters</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <AppDateRangeField
          from={filters.date_from ?? ''}
          to={filters.date_to ?? ''}
          onChange={({ from, to }) => set({ date_from: from, date_to: to })}
          className="min-w-[14rem]"
        />
        <Select value={filters.store ?? 'all'} onValueChange={(v) => set({ store: v })}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Store" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stores</SelectItem>
            {MOCK_STORES.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.courier ?? 'all'} onValueChange={(v) => set({ courier: v })}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Courier" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Couriers</SelectItem>
            {MOCK_COURIERS.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.status ?? 'all'} onValueChange={(v) => set({ status: v as ReportFilters['status'] })}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {ORDER_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.fraud_level ?? 'all'} onValueChange={(v) => set({ fraud_level: v as ReportFilters['fraud_level'] })}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Fraud" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Risk</SelectItem>
            <SelectItem value="SAFE">Safe</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="BLOCKED">Blocked</SelectItem>
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  )
}
