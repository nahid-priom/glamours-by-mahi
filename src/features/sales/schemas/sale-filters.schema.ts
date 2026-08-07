import { z } from 'zod'
import {
  addDaysYmd,
  endOfMonthYmd,
  resolveShortcut,
  startOfMonthYmd,
  todayYmd,
} from '@/lib/datetime/bd'
import type { SalesDatePreset, SalesHistoryFilters, SalesSort } from '../types/sale.types'

export function resolvePresetRange(
  preset: SalesDatePreset,
  fromDate: string | null,
  toDate: string | null,
  now: Date = new Date(),
): { fromDate: string | null; toDate: string | null } {
  const today = todayYmd(now)
  if (preset === 'all') return { fromDate: null, toDate: null }
  if (preset === 'custom') return { fromDate, toDate }
  if (preset === 'today') {
    const r = resolveShortcut('today', now)
    return { fromDate: r.from, toDate: r.to }
  }
  if (preset === 'this_week') {
    const r = resolveShortcut('this_week', now)
    return { fromDate: r.from, toDate: r.to }
  }
  if (preset === 'this_month') {
    const r = resolveShortcut('this_month', now)
    return { fromDate: r.from, toDate: r.to }
  }
  if (preset === 'yesterday') {
    const d = addDaysYmd(today, -1)
    return { fromDate: d, toDate: d }
  }
  if (preset === 'last_7') {
    return { fromDate: addDaysYmd(today, -6), toDate: today }
  }
  if (preset === 'last_month') {
    const prevMonthDay = addDaysYmd(startOfMonthYmd(today), -1)
    return { fromDate: startOfMonthYmd(prevMonthDay), toDate: endOfMonthYmd(prevMonthDay) }
  }
  return { fromDate: null, toDate: null }
}

export const salesFiltersSchema = z.object({
  search: z.string().default(''),
  preset: z
    .enum([
      'today',
      'yesterday',
      'this_week',
      'last_7',
      'this_month',
      'last_month',
      'custom',
      'all',
    ])
    .default('this_month'),
  fromDate: z.string().nullable().default(null),
  toDate: z.string().nullable().default(null),
  customerId: z.string().nullable().default(null),
  branchId: z.string().nullable().default(null),
  cashierId: z.string().nullable().default(null),
  status: z.string().nullable().default(null),
  paymentStatus: z.string().nullable().default(null),
  paymentMethod: z.string().nullable().default(null),
  categoryId: z.string().nullable().default(null),
  dueOnly: z.boolean().default(false),
  sort: z
    .enum(['date_desc', 'date_asc', 'total_desc', 'total_asc', 'invoice_desc', 'invoice_asc'])
    .default('date_desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(20),
})

export type SalesFiltersForm = z.infer<typeof salesFiltersSchema>

export function defaultSalesFilters(branchId?: string | null): SalesHistoryFilters {
  const preset: SalesDatePreset = 'this_month'
  const range = resolvePresetRange(preset, null, null)
  return {
    search: '',
    preset,
    fromDate: range.fromDate,
    toDate: range.toDate,
    customerId: null,
    branchId: branchId ?? null,
    cashierId: null,
    status: null,
    paymentStatus: null,
    paymentMethod: null,
    categoryId: null,
    dueOnly: false,
    sort: 'date_desc',
    page: 1,
    pageSize: 20,
  }
}

export function filtersFromSearchParams(
  params: URLSearchParams,
  fallbackBranchId?: string | null,
): SalesHistoryFilters {
  const raw = {
    search: params.get('q') ?? '',
    preset: (params.get('preset') as SalesDatePreset) || 'this_month',
    fromDate: params.get('from'),
    toDate: params.get('to'),
    customerId: params.get('customer'),
    branchId: params.get('branch') ?? fallbackBranchId ?? null,
    cashierId: params.get('cashier'),
    status: params.get('status'),
    paymentStatus: params.get('payStatus'),
    paymentMethod: params.get('payMethod'),
    categoryId: params.get('category'),
    dueOnly: params.get('dueOnly') === '1',
    sort: (params.get('sort') as SalesSort) || 'date_desc',
    page: params.get('page') ?? '1',
    pageSize: params.get('pageSize') ?? '20',
  }

  const parsed = salesFiltersSchema.safeParse(raw)
  const base = parsed.success ? parsed.data : defaultSalesFilters(fallbackBranchId)
  const range = resolvePresetRange(base.preset, base.fromDate, base.toDate)
  return {
    ...base,
    fromDate: range.fromDate,
    toDate: range.toDate,
  }
}

export function filtersToSearchParams(filters: SalesHistoryFilters): URLSearchParams {
  const p = new URLSearchParams()
  if (filters.search.trim()) p.set('q', filters.search.trim())
  if (filters.preset !== 'this_month') p.set('preset', filters.preset)
  if (filters.preset === 'custom') {
    if (filters.fromDate) p.set('from', filters.fromDate)
    if (filters.toDate) p.set('to', filters.toDate)
  }
  if (filters.customerId) p.set('customer', filters.customerId)
  if (filters.branchId) p.set('branch', filters.branchId)
  if (filters.cashierId) p.set('cashier', filters.cashierId)
  if (filters.status) p.set('status', filters.status)
  if (filters.paymentStatus) p.set('payStatus', filters.paymentStatus)
  if (filters.paymentMethod) p.set('payMethod', filters.paymentMethod)
  if (filters.categoryId) p.set('category', filters.categoryId)
  if (filters.dueOnly) p.set('dueOnly', '1')
  if (filters.sort !== 'date_desc') p.set('sort', filters.sort)
  if (filters.page > 1) p.set('page', String(filters.page))
  if (filters.pageSize !== 20) p.set('pageSize', String(filters.pageSize))
  return p
}

export function filtersToRpcPayload(filters: SalesHistoryFilters) {
  const range = resolvePresetRange(filters.preset, filters.fromDate, filters.toDate)
  return {
    search: filters.search.trim() || null,
    from_date: range.fromDate,
    to_date: range.toDate,
    customer_id: filters.customerId,
    branch_id: filters.branchId,
    cashier_id: filters.cashierId,
    status: filters.status,
    payment_status: filters.paymentStatus,
    payment_method: filters.paymentMethod,
    category_id: filters.categoryId,
    due_only: filters.dueOnly,
    sort: filters.sort,
    page: filters.page,
    page_size: filters.pageSize,
  }
}

export function formatCategoryChips(
  chips: Array<{ name: string; qty: number }> | null | undefined,
  maxVisible = 3,
): string {
  const list = chips ?? []
  if (list.length === 0) return '—'
  const visible = list.slice(0, maxVisible)
  const text = visible.map((c) => `${c.name} ×${Number(c.qty)}`).join(' • ')
  const remaining = list.length - visible.length
  return remaining > 0 ? `${text} • +${remaining} more` : text
}
