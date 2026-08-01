import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/auth.context'
import { queryKeys } from '@/lib/query/keys'
import { getDashboardOverview } from '../repositories/dashboard.repository'

function dayStartIso(d = new Date()) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.toISOString()
}

function dayEndIso(d = new Date()) {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x.toISOString()
}

export function useDashboardOverview(branchId: string) {
  const { profile } = useAuth()
  const [searchParams] = useSearchParams()

  const dateFrom = searchParams.get('date_from') ?? dayStartIso()
  const dateTo = searchParams.get('date_to') ?? dayEndIso()

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
