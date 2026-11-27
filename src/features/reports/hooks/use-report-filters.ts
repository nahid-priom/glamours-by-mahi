import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { compareYmd, isYmd } from '@/lib/datetime/bd'
import {
  countActiveFilters,
  defaultPeriodRange,
  resolveDatePreset,
  type DatePresetId,
  type ReportFilterContract,
} from '../reports.filters'

function readFromParams(
  params: URLSearchParams,
  defaults: ReportFilterContract,
): ReportFilterContract {
  const fromParam = params.get('from')
  const toParam = params.get('to')
  const from = isYmd(fromParam) ? fromParam : defaults.from
  const to = isYmd(toParam) ? toParam : defaults.to
  const validOrder = compareYmd(from, to) <= 0
  return {
    ...defaults,
    from: validOrder ? from : defaults.from,
    to: validOrder ? to : defaults.to,
    branchId: params.get('branchId') || null,
    search: params.get('search') || null,
    status: params.get('status') || null,
    channel: params.get('channel') || null,
    customerId: params.get('customerId') || null,
    supplierId: params.get('supplierId') || null,
    salespersonId: params.get('salespersonId') || null,
    level: (params.get('level') as 'product' | 'variant' | null) || defaults.level || null,
    page: params.get('page') ? Number(params.get('page')) : 1,
    pageSize: defaults.pageSize ?? 50,
  }
}

function toSearchParams(filters: ReportFilterContract): URLSearchParams {
  const next = new URLSearchParams()
  next.set('from', filters.from)
  next.set('to', filters.to)
  if (filters.branchId) next.set('branchId', filters.branchId)
  if (filters.search) next.set('search', filters.search)
  if (filters.status) next.set('status', filters.status)
  if (filters.channel) next.set('channel', filters.channel)
  if (filters.customerId) next.set('customerId', filters.customerId)
  if (filters.supplierId) next.set('supplierId', filters.supplierId)
  if (filters.salespersonId) next.set('salespersonId', filters.salespersonId)
  if (filters.level) next.set('level', filters.level)
  if (filters.page && filters.page > 1) next.set('page', String(filters.page))
  return next
}

export function useReportFilters(options?: {
  syncUrl?: boolean
  defaults?: Partial<ReportFilterContract>
  activeKeys?: (keyof ReportFilterContract)[]
}) {
  const syncUrl = options?.syncUrl ?? true
  const period = useMemo(() => defaultPeriodRange(), [])
  const defaults = useMemo<ReportFilterContract>(
    () => ({
      from: period.from,
      to: period.to,
      page: 1,
      pageSize: 50,
      ...options?.defaults,
    }),
    [period.from, period.to, options?.defaults],
  )

  const [params, setParams] = useSearchParams()
  const [local, setLocal] = useState<ReportFilterContract>(defaults)

  const filters = syncUrl ? readFromParams(params, defaults) : local

  const setFilters = useCallback(
    (patch: Partial<ReportFilterContract>) => {
      const next = {
        ...(syncUrl ? readFromParams(params, defaults) : local),
        ...patch,
        page: patch.page ?? (patch.from || patch.to || patch.search || patch.status || patch.branchId
          ? 1
          : patch.page) ?? 1,
      }
      if (syncUrl) setParams(toSearchParams(next), { replace: true })
      setLocal(next)
    },
    [syncUrl, params, defaults, local, setParams],
  )

  const applyPreset = useCallback(
    (id: DatePresetId) => {
      const range = resolveDatePreset(id)
      setFilters({ from: range.from, to: range.to })
    },
    [setFilters],
  )

  const clearFilters = useCallback(() => {
    if (syncUrl) setParams(toSearchParams(defaults), { replace: true })
    setLocal(defaults)
  }, [defaults, setParams, syncUrl])

  const activeCount = useMemo(
    () =>
      countActiveFilters(
        filters,
        options?.activeKeys ?? [
          'branchId',
          'search',
          'status',
          'channel',
          'customerId',
          'supplierId',
          'salespersonId',
        ],
      ),
    [filters, options?.activeKeys],
  )

  return {
    filters,
    setFilters,
    applyPreset,
    clearFilters,
    activeCount,
    range: { from: filters.from, to: filters.to },
  }
}
