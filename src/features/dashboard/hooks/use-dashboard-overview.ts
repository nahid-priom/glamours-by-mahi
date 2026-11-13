import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/auth.context'
import { todayYmd, toQueryBounds } from '@/lib/datetime/bd'
import { queryKeys } from '@/lib/query/keys'
import { getDashboardOverview } from '../repositories/dashboard.repository'

export function useDashboardOverview(branchId: string) {
  const { profile } = useAuth()
  const [searchParams] = useSearchParams()

  const rawFrom = searchParams.get('date_from')
  const rawTo = searchParams.get('date_to')
  const fromYmd = rawFrom && /^\d{4}-\d{2}-\d{2}/.test(rawFrom) ? rawFrom.slice(0, 10) : todayYmd()
  const toYmd = rawTo && /^\d{4}-\d{2}-\d{2}/.test(rawTo) ? rawTo.slice(0, 10) : todayYmd()
  const bounds = toQueryBounds(fromYmd, toYmd)
  const dateFrom = bounds.fromIso ?? new Date().toISOString()
  const dateTo = bounds.toIso ?? new Date().toISOString()

  const queryKey = useMemo(
    () =>
      queryKeys.dashboard({
        branchId: branchId || null,
        dateFrom,
        dateTo,
      }),
    [branchId, dateFrom, dateTo],
  )

  return useQuery({
    queryKey,
    queryFn: () =>
      getDashboardOverview({
        branchId: branchId || null,
        dateFrom,
        dateTo,
      }),
    enabled: Boolean(profile),
    staleTime: 0,
    refetchOnMount: 'always',
  })
}
