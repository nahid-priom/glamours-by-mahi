import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-session'
import { BranchSwitcher } from '@/components/layout/BranchSwitcher'
import { useStaffDashboard } from '../hooks/use-staff-dashboard'
import { listStaffTargets } from '../repositories/staff.repository'
import { TargetProgressCard } from '../components/TargetProgressCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatBDT, formatDateShort } from '@/lib/format'

export function MyTargetsPage() {
  const { branchIds, activeBranchId } = useAuth()
  const [params] = useSearchParams()
  const branchFromUrl = params.get('branch_id')
  const { data, isLoading, error } = useStaffDashboard(branchFromUrl ?? activeBranchId)
  const history = useQuery({
    queryKey: ['my-staff-targets-history'],
    queryFn: () => listStaffTargets({ limit: 50 }),
  })

  const items = history.data?.items ?? []

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">My Targets</h1>
          <p className="text-sm text-[#6B7280]">
            Achievement uses your attributed sales only — not organization-wide totals.
          </p>
        </div>
        {branchIds.length > 1 ? <BranchSwitcher /> : null}
      </div>
      {isLoading ? <p className="text-sm text-[#6B7280]">Loading…</p> : null}
      {error ? <p className="text-sm text-[#E11D48]">{(error as Error).message}</p> : null}
      <TargetProgressCard target={data?.target ?? null} />
      {data?.target ? (
        <dl className="grid grid-cols-2 gap-3 rounded-2xl border bg-white p-4 text-sm">
          <div>
            <dt className="text-xs text-[#6B7280]">Achieved orders</dt>
            <dd className="font-semibold">{data.target.achieved_orders}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#6B7280]">Order target</dt>
            <dd className="font-semibold">{data.target.order_count || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#6B7280]">Period</dt>
            <dd className="font-semibold capitalize">{data.target.period}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#6B7280]">Ends</dt>
            <dd className="font-semibold">{data.target.ends_at}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-[#6B7280]">This month attributed sales</dt>
            <dd className="font-semibold">{formatBDT(Number(data.kpis.month_sales))}</dd>
          </div>
        </dl>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Previous targets</h2>
        {history.isLoading ? (
          <p className="text-sm text-[#6B7280]">Loading history…</p>
        ) : items.length === 0 ? (
          <EmptyState title="No target history" description="Assigned targets will appear here." />
        ) : (
          <ul className="divide-y rounded-2xl border bg-white text-sm">
            {items.map((row) => {
              const salesTarget = Number(row.sales_amount) || 0
              const orderTarget = Number(row.order_count) || 0
              const pct =
                salesTarget > 0
                  ? Math.min(100, Math.round((Number(row.achieved_sales) / salesTarget) * 100))
                  : 0
              return (
                <li key={row.id} className="px-4 py-3">
                  <div className="flex justify-between gap-2">
                    <p className="font-medium capitalize">{row.target_period}</p>
                    <span className="capitalize text-[#6B7280]">{row.status}</span>
                  </div>
                  <p className="text-xs text-[#6B7280]">
                    {salesTarget > 0
                      ? `${formatBDT(Number(row.achieved_sales))} / ${formatBDT(salesTarget)} (${pct}%)`
                      : orderTarget > 0
                        ? `Order target ${orderTarget}`
                        : '—'}{' '}
                    · {formatDateShort(row.starts_at)} → {formatDateShort(row.ends_at)}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
