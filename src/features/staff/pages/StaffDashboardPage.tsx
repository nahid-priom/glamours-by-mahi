import { Link, useSearchParams } from 'react-router-dom'
import {
  Banknote,
  ClipboardList,
  Phone,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { formatBDT } from '@/lib/format'
import { useAuth } from '@/features/auth/auth-session'
import { DashboardKpiCard } from '@/features/dashboard/components/DashboardKpiCard'
import { Button } from '@/components/ui/button'
import { BranchSwitcher } from '@/components/layout/BranchSwitcher'
import { EmptyState } from '@/components/shared/EmptyState'
import { useStaffDashboard } from '../hooks/use-staff-dashboard'
import { getStaffPerformanceMessage } from '../lib/performance-message'
import { TargetProgressCard } from '../components/TargetProgressCard'

function pctChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 1000) / 10
}

export function StaffDashboardPage() {
  const { profile, activeBranchId, branchIds } = useAuth()
  const [params] = useSearchParams()
  const branchFromUrl = params.get('branch_id')
  const { data, isLoading, error, dataUpdatedAt, refetch } = useStaffDashboard(
    branchFromUrl ?? activeBranchId,
  )

  const message = data
    ? getStaffPerformanceMessage({
        staffName: profile?.full_name ?? 'Staff',
        todaySales: Number(data.kpis.today_sales),
        yesterdaySales: Number(data.kpis.yesterday_sales),
        todayOrders: Number(data.kpis.today_orders),
        targetAmount: data.target ? Number(data.target.sales_amount) : null,
        achievedSales: data.target ? Number(data.target.achieved_sales) : 0,
        followUpsDue: Number(data.kpis.follow_ups_due),
        followUpsOverdue: Number(data.kpis.follow_ups_overdue),
        commissionToday: Number(data.kpis.commission_today),
        pendingOrders: Number(data.kpis.pending_orders),
      })
    : null

  const toneClass =
    message?.tone === 'success'
      ? 'border-emerald-200 bg-emerald-50'
      : message?.tone === 'warn'
        ? 'border-amber-200 bg-amber-50'
        : message?.tone === 'encourage'
          ? 'border-sky-200 bg-sky-50'
          : 'border-border bg-white'

  const qs = activeBranchId ? `?branch_id=${activeBranchId}` : ''

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
            {profile?.role_name ?? 'Staff'} ·{' '}
            {new Date().toLocaleDateString('bn-BD', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
          <h1 className="mt-1 text-xl font-bold text-[#111827]">My Workspace</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {branchIds.length > 1 ? <BranchSwitcher allowAll={false} /> : null}
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Refresh
          </Button>
          <Button asChild size="sm">
            <Link to="/moderator/orders/new">New Order</Link>
          </Button>
        </div>
      </div>

      {message ? (
        <div className={`rounded-2xl border p-4 ${toneClass}`}>
          <p className="text-base font-semibold text-[#111827]">{message.headline}</p>
          {message.detail ? <p className="mt-1 text-sm text-[#4B5563]">{message.detail}</p> : null}
        </div>
      ) : null}

      {error ? <p className="text-sm text-[#E11D48]">{(error as Error).message}</p> : null}

      {isLoading ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[88px] animate-pulse rounded-xl bg-[#F3F4F6]" />
          ))}
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <DashboardKpiCard
              title="আজকের Sale"
              value={Number(data.kpis.today_sales)}
              icon={Banknote}
              tone="rose"
              trend={pctChange(Number(data.kpis.today_sales), Number(data.kpis.yesterday_sales))}
              trendLabel="গতকালের তুলনায়"
              to={`/staff/my-sales${qs}`}
            />
            <DashboardKpiCard
              title="আজকের Order"
              value={Number(data.kpis.today_orders)}
              icon={ClipboardList}
              tone="blue"
              trend={0}
              trendLabel={`${data.kpis.today_orders} orders`}
              to={`/staff/my-orders${qs}`}
            />
            <DashboardKpiCard
              title="Commission"
              value={Number(data.kpis.commission_today)}
              icon={Wallet}
              tone="green"
              trend={0}
              trendLabel="আজ · Estimated"
              to="/staff/my-commission"
            />
            <DashboardKpiCard
              title="Target"
              value={data.target ? Number(data.target.achieved_sales) : 0}
              icon={Target}
              tone="amber"
              trend={data.target ? Number(data.target.pct) : 0}
              trendLabel={data.target ? `${data.target.pct}% complete` : 'Not set'}
              to="/staff/my-targets"
            />
            <DashboardKpiCard
              title="Follow-up"
              value={Number(data.kpis.follow_ups_due)}
              icon={Phone}
              tone="slate"
              trend={0}
              trendLabel={
                data.kpis.follow_ups_overdue > 0
                  ? `${data.kpis.follow_ups_overdue} overdue`
                  : 'due today'
              }
              to="/staff/follow-ups"
            />
            <DashboardKpiCard
              title="Pending Order"
              value={Number(data.kpis.pending_orders)}
              icon={TrendingUp}
              tone="slate"
              trend={0}
              trendLabel="action needed"
              to={`/staff/my-orders?status=pending_approval${activeBranchId ? `&branch_id=${activeBranchId}` : ''}`}
            />
          </div>

          <p className="text-[11px] text-[#9CA3AF]">
            Updated {new Date(data.refreshed_at ?? dataUpdatedAt).toLocaleTimeString()}
          </p>

          <TargetProgressCard target={data.target} />

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-border bg-white">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="text-sm font-semibold">Recent Sales</h2>
                <Link to={`/staff/my-sales${qs}`} className="text-xs font-medium text-[#E11D48]">
                  সব দেখুন
                </Link>
              </div>
              {data.recent_sales.length === 0 ? (
                <EmptyState title="এখনো Sale নেই" description="নতুন Order তৈরি করে শুরু করুন।" />
              ) : (
                <ul className="divide-y">
                  {data.recent_sales.map((s) => (
                    <li key={s.id}>
                      <Link
                        to={`/sales/${s.id}`}
                        className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#F9FAFB]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{s.invoice_no}</p>
                          <p className="truncate text-xs text-[#6B7280]">
                            {s.customer_name ?? 'Walk-in'} ·{' '}
                            {new Date(s.created_at).toLocaleString()}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold">{formatBDT(Number(s.grand_total))}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-white">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="text-sm font-semibold">Pending Follow-ups</h2>
                <Link to="/staff/follow-ups" className="text-xs font-medium text-[#E11D48]">
                  সব দেখুন
                </Link>
              </div>
              {data.pending_follow_ups.length === 0 ? (
                <EmptyState
                  title="Follow-up নেই"
                  description="Customer-এর জন্য পরবর্তী Call সেট করুন।"
                />
              ) : (
                <ul className="divide-y">
                  {data.pending_follow_ups.map((f) => (
                    <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{f.customer_name}</p>
                        <p className="text-xs text-[#6B7280]">
                          {new Date(f.follow_up_at).toLocaleString()} · Due{' '}
                          {formatBDT(Number(f.current_due))}
                        </p>
                      </div>
                      {f.customer_phone ? (
                        <a
                          href={`tel:${f.customer_phone}`}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#F3F4F6]"
                          aria-label="Call"
                        >
                          <Phone className="h-4 w-4" />
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      ) : null}

      {/* Mobile sticky quick actions */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-white/95 p-2 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-6xl grid-cols-4 gap-1">
          {[
            { to: '/moderator/orders/new', label: 'Order' },
            { to: '/staff/follow-ups', label: 'Follow-up' },
            { to: '/staff/my-commission', label: 'Commission' },
            { to: '/customers/new', label: 'Customer' },
          ].map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className="rounded-xl px-1 py-2 text-center text-[11px] font-semibold text-[#111827] hover:bg-[#F3F4F6]"
            >
              {a.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
