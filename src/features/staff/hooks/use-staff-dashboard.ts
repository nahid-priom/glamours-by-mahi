import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-session'
import { getStaffDashboardSummary } from '../repositories/staff.repository'

export function useStaffDashboard(branchId?: string | null) {
  const { profile, activeBranchId } = useAuth()
  const branch = branchId === undefined ? activeBranchId : branchId

  return useQuery({
    queryKey: ['staff-dashboard', profile?.id ?? null, branch ?? null],
    queryFn: () => getStaffDashboardSummary({ branchId: branch }),
    enabled: Boolean(profile),
    staleTime: 30_000,
    refetchOnMount: 'always',
  })
}
