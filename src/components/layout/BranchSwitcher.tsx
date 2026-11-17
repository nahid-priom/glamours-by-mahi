import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2 } from 'lucide-react'
import { useAuth } from '@/features/auth/auth-session'
import { listDashboardBranches } from '@/features/dashboard/repositories/dashboard.repository'
import { queryKeys } from '@/lib/query/keys'
import { cn } from '@/lib/utils'

interface BranchSwitcherProps {
  className?: string
  /** When true, include an "All Branches" option (clears active branch). */
  allowAll?: boolean
  size?: 'sm' | 'md'
}

function invalidateBranchScopedQueries(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['products'] })
  void qc.invalidateQueries({ queryKey: ['pos-products'] })
  void qc.invalidateQueries({ queryKey: ['stock-overview'] })
  void qc.invalidateQueries({ queryKey: ['inventory'] })
  void qc.invalidateQueries({ queryKey: ['inventory-stock-breakdown'] })
  void qc.invalidateQueries({ queryKey: ['inventory-valuation-summary'] })
  void qc.invalidateQueries({ queryKey: ['inventory-low-stock'] })
  void qc.invalidateQueries({ queryKey: ['low-stock'] })
  void qc.invalidateQueries({ queryKey: ['stock-ledger'] })
  void qc.invalidateQueries({ queryKey: ['product-catalog-kpis'] })
  void qc.invalidateQueries({ queryKey: queryKeys.accounts })
}

export function BranchSwitcher({ className, allowAll = true, size = 'sm' }: BranchSwitcherProps) {
  const { activeBranchId, setActiveBranchId, branchIds, profile } = useAuth()
  const qc = useQueryClient()

  const { data: branches = [] } = useQuery({
    queryKey: queryKeys.dashboardBranches,
    queryFn: listDashboardBranches,
    enabled: Boolean(profile),
    staleTime: 60_000,
  })

  const allowed = branchIds.length
    ? branches.filter((b) => branchIds.includes(b.id))
    : branches

  const value = activeBranchId ?? ''

  return (
    <label
      className={cn(
        'inline-flex items-center gap-1.5 rounded-xl border border-border bg-slate-50',
        size === 'sm' ? 'px-2 py-1' : 'px-3 py-1.5',
        className,
      )}
    >
      <Building2 className="h-3.5 w-3.5 shrink-0 text-text-muted" aria-hidden />
      <span className="sr-only">Branch</span>
      <select
        className={cn(
          'max-w-[160px] bg-transparent text-xs font-medium text-[#111111] outline-none',
          size === 'md' && 'max-w-[200px] text-sm',
        )}
        value={value}
        onChange={(e) => {
          const next = e.target.value || null
          setActiveBranchId(next)
          invalidateBranchScopedQueries(qc)
        }}
        aria-label="Select branch"
      >
        {allowAll ? <option value="">All Branches</option> : null}
        {allowed.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </label>
  )
}
