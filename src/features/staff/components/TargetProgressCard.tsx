import { formatBDT } from '@/lib/format'
import { targetStatusLabel } from '../lib/performance-message'
import type { StaffDashboardSummary } from '../repositories/staff.repository'

export function TargetProgressCard({ target }: { target: StaffDashboardSummary['target'] }) {
  if (!target) {
    return (
      <div className="rounded-2xl border border-border bg-white p-4">
        <h2 className="text-sm font-semibold text-[#111827]">Target Progress</h2>
        <p className="mt-2 text-sm text-[#6B7280]">
          এখনো কোনো Target সেট করা হয়নি। Admin থেকে Daily/Monthly Target অ্যাসাইন করুন।
        </p>
      </div>
    )
  }

  const pct = Math.min(Number(target.pct) || 0, 100)
  const remaining = Math.max(Number(target.sales_amount) - Number(target.achieved_sales), 0)
  const days = Number(target.days_remaining) || 0
  const dailyPace = days > 0 ? remaining / days : remaining
  const status = targetStatusLabel(pct, days)

  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-[#111827]">
            {target.period === 'daily'
              ? 'Daily Target'
              : target.period === 'weekly'
                ? 'Weekly Target'
                : 'Monthly Target'}
          </h2>
          <p className="mt-1 text-lg font-bold text-[#111827]">
            {formatBDT(Number(target.achieved_sales))}{' '}
            <span className="text-sm font-medium text-[#6B7280]">
              / {formatBDT(Number(target.sales_amount))}
            </span>
          </p>
        </div>
        <span className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs font-semibold text-[#374151]">
          {status} · {pct}%
        </span>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#F3F4F6]">
        <div
          className="h-full rounded-full bg-[#E11D48] transition-all"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <p className="mt-3 text-sm text-[#4B5563]">
        {days} Days Remaining
        {remaining > 0
          ? ` · Target ঠিক রাখতে প্রতিদিন গড়ে ${formatBDT(dailyPace)} Sale প্রয়োজন।`
          : ' · Target পূরণ হয়েছে!'}
      </p>
    </div>
  )
}
