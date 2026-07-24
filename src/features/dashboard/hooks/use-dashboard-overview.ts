import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth.context'
import { queryKeys } from '@/lib/query/keys'
import { getDashboardOverview } from '../repositories/dashboard.repository'

export function useDashboardOverview(branchId: string) {
  const { profile } = useAuth()

  return useQuery({
    queryKey: queryKeys.dashboard({ branchId: branchId || null }),
    queryFn: () => getDashboardOverview(branchId || null),
    enabled: Boolean(profile),
    staleTime: 0,
    refetchOnMount: 'always',
  })
}
