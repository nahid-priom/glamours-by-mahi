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

  const salesTarget = Number(target.sales_amount) || 0
  const orderTarget = Number(target.order_count) || 0
  const ordersAchieved = Number(target.achieved_orders) || 0
  const salesOnly = salesTarget > 0
  const ordersOnly = orderTarget > 0 && salesTarget <= 0
  const both = salesTarget > 0 && orderTarget > 0

  const salesPct =
    salesTarget > 0
      ? Math.min(100, Math.round((Number(target.achieved_sales) / salesTarget) * 100))
      : 0
  const orderPct =
    orderTarget > 0 ? Math.min(100, Math.round((ordersAchieved / orderTarget) * 100)) : null
  const pct = ordersOnly ? (orderPct ?? 0) : Math.min(Number(target.pct) || salesPct, 100)
  const remaining = Math.max(salesTarget - Number(target.achieved_sales), 0)
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
            {ordersOnly ? ' · Orders' : salesOnly || both ? ' · Sales' : ''}
          </h2>
          {salesOnly || both ? (
            <p className="mt-1 text-lg font-bold text-[#111827]">
              {formatBDT(Number(target.achieved_sales))}{' '}
              <span className="text-sm font-medium text-[#6B7280]">
                / {formatBDT(salesTarget)}
              </span>
            </p>
          ) : null}
          {ordersOnly ? (
            <p className="mt-1 text-lg font-bold text-[#111827]">
              {ordersAchieved}{' '}
              <span className="text-sm font-medium text-[#6B7280]">/ {orderTarget} orders</span>
            </p>
          ) : null}
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
      {both && orderPct != null ? (
        <p className="mt-2 text-xs text-[#6B7280]">
          Orders {ordersAchieved} / {orderTarget} ({orderPct}%)
        </p>
      ) : null}
      <p className="mt-3 text-sm text-[#4B5563]">
        {days} Days Remaining
        {salesOnly || both
          ? remaining > 0
            ? ` · Target ঠিক রাখতে প্রতিদিন গড়ে ${formatBDT(dailyPace)} Sale প্রয়োজন।`
            : ' · Target পূরণ হয়েছে!'
          : ordersOnly
            ? orderPct != null && orderPct >= 100
              ? ' · Order target পূরণ হয়েছে!'
              : ' · Order target চলমান।'
            : null}
      </p>
    </div>
  )
}
