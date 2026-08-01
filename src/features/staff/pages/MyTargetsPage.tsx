import { useStaffDashboard } from '../hooks/use-staff-dashboard'
import { TargetProgressCard } from '../components/TargetProgressCard'
import { formatBDT } from '@/lib/format'

export function MyTargetsPage() {
  const { data, isLoading, error } = useStaffDashboard()

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-xl font-bold">My Targets</h1>
        <p className="text-sm text-[#6B7280]">Daily / Weekly / Monthly Target অগ্রগতি</p>
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
            <dt className="text-xs text-[#6B7280]">This month sales (all)</dt>
            <dd className="font-semibold">{formatBDT(Number(data.kpis.month_sales))}</dd>
          </div>
        </dl>
      ) : null}
    </div>
  )
}
