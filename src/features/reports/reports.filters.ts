/**
 * Shared Reports V4 filter contract + date presets (Asia/Dhaka calendar).
 * @see docs/architecture/REPORTS_V4_ARCHITECTURE.md
 */
import {
  addDaysYmd,
  endOfMonthYmd,
  formatYmd,
  parseYmd,
  startOfMonthYmd,
  todayYmd,
} from '@/lib/datetime/bd'

export type ReportFilterContract = {
  from: string
  to: string
  branchId?: string | null
  warehouseId?: string | null
  customerId?: string | null
  supplierId?: string | null
  productId?: string | null
  salespersonId?: string | null
  paymentMethod?: string | null
  channel?: string | null
  status?: string | null
  search?: string | null
  level?: 'product' | 'variant' | null
  page?: number
  pageSize?: number
}

export function reportQueryKey(
  reportType: string,
  filters: Pick<ReportFilterContract, 'from' | 'to' | 'branchId' | 'page' | 'pageSize'> &
    Record<string, unknown>,
) {
  return [
    'reports',
    'v4',
    reportType,
    filters.from,
    filters.to,
    filters.branchId ?? null,
    filters.page ?? 1,
    filters.pageSize ?? null,
    filters.search ?? null,
    filters.status ?? null,
    filters.channel ?? null,
    filters.level ?? null,
    filters.customerId ?? null,
    filters.supplierId ?? null,
    filters.salespersonId ?? null,
  ] as const
}

export const DATE_PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7', label: 'Last 7 Days' },
  { id: 'thisMonth', label: 'This Month' },
  { id: 'lastMonth', label: 'Last Month' },
  { id: 'thisYear', label: 'This Year' },
  { id: 'custom', label: 'Custom' },
] as const

export type DatePresetId = (typeof DATE_PRESETS)[number]['id']

export function resolveDatePreset(id: DatePresetId, now = new Date()): { from: string; to: string } {
  const today = todayYmd(now)
  switch (id) {
    case 'today':
      return { from: today, to: today }
    case 'yesterday': {
      const y = addDaysYmd(today, -1)
      return { from: y, to: y }
    }
    case 'last7':
      return { from: addDaysYmd(today, -6), to: today }
    case 'thisMonth':
      return { from: startOfMonthYmd(today), to: today }
    case 'lastMonth': {
      const { y, m } = parseYmd(today)
      const prevMonth = m === 1 ? 12 : m - 1
      const prevYear = m === 1 ? y - 1 : y
      const anchor = formatYmd(prevYear, prevMonth, 1)
      return { from: startOfMonthYmd(anchor), to: endOfMonthYmd(anchor) }
    }
    case 'thisYear': {
      const { y } = parseYmd(today)
      return { from: formatYmd(y, 1, 1), to: today }
    }
    case 'custom':
    default:
      return { from: startOfMonthYmd(today), to: today }
  }
}

/** Default period for period-based reports: This Month. */
export function defaultPeriodRange(now = new Date()): { from: string; to: string } {
  return resolveDatePreset('thisMonth', now)
}

export function countActiveFilters(
  filters: ReportFilterContract,
  keys: (keyof ReportFilterContract)[],
): number {
  let n = 0
  for (const k of keys) {
    const v = filters[k]
    if (v == null || v === '') continue
    if (k === 'from' || k === 'to' || k === 'page' || k === 'pageSize' || k === 'level') continue
    n += 1
  }
  return n
}
