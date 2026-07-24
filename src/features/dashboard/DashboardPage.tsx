import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Building2,
  Loader2,
  Users,
  Wallet,
} from 'lucide-react'
import { useAuth } from '@/features/auth/auth.context'
import { formatBDT } from '@/lib/format'
import { queryKeys } from '@/lib/query/keys'
import { DashboardKpiCard } from './components/DashboardKpiCard'
import { SalesOverviewChart } from './components/SalesOverviewChart'
import { SalesChannelChart } from './components/SalesChannelChart'
import { CourierStatusCard } from './components/CourierStatusCard'
import { TopSellingProductsCard } from './components/TopSellingProductsCard'
import { BranchPerformanceCard } from './components/BranchPerformanceCard'
import { LowStockCard } from './components/LowStockCard'
import { CashFlowChart } from './components/CashFlowChart'
import { AttendanceSummaryCard } from './components/AttendanceSummaryCard'
import { RecentActivityCard } from './components/RecentActivityCard'
import { DashboardSectionCard } from './components/DashboardSectionCard'
import {
  getDashboardOverview,
  listDashboardBranches,
} from './repositories/dashboard.repository'

export function DashboardPage() {
  const { session, profile } = useAuth()
  const [branchId, setBranchId] = useState(session.branchId ?? '')

  const { data: branches = [] } = useQuery({
    queryKey: queryKeys.dashboardBranches,
    queryFn: listDashboardBranches,
    enabled: Boolean(profile),
  })

  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.dashboard({ branchId: branchId || null }),
    queryFn: () => getDashboardOverview(branchId || null),
    enabled: Boolean(profile),
  })

  const salesSpark = data?.salesOverview.map((d) => d.sales) ?? []
  const collectionSpark = data?.salesOverview.map((d) => d.collection) ?? []

  if (!profile) {
    return (
      <p className="p-4 text-sm text-[#6B7280]">Sign in to load live dashboard metrics from Supabase.</p>
    )
  }

  return (
    <div className="mx-auto max-w-[1366px] space-y-4 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-9 rounded-full border border-[#E5E7EB] bg-white px-3 text-xs font-medium text-[#111111]"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          >
            <option value="">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <span className="rounded-full border border-[#E5E7EB] bg-white px-3 py-2 text-[11px] text-[#6B7280]">
            Today · Live Supabase
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-[#6B7280]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading dashboard…
        </div>
      ) : null}
      {error ? (
        <p className="text-sm text-[#E11D48]">Failed to load dashboard metrics.</p>
      ) : null}

      {data ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <DashboardKpiCard
              title="Today's Sales"
              value={data.kpis.todaySales}
              icon={Banknote}
              tone="rose"
              trend={data.kpis.trends.sales}
              sparkline={salesSpark}
              to="/sales"
            />
            <DashboardKpiCard
              title="Today's Collection"
              value={data.kpis.todayCollection}
              icon={ArrowDownRight}
              tone="green"
              trend={data.kpis.trends.collection}
              sparkline={collectionSpark}
              to="/sales/collections"
            />
            <DashboardKpiCard
              title="Today's Expenses"
              value={data.kpis.todayExpenses}
              icon={ArrowUpRight}
              tone="amber"
              trend={data.kpis.trends.expenses}
              to="/accounts/expenses"
            />
            <DashboardKpiCard
              title="Net Cash Flow"
              value={data.kpis.netCashFlow}
              icon={Wallet}
              tone="blue"
              trend={data.kpis.trends.netCashFlow}
              to="/accounts"
            />
            <DashboardKpiCard
              title="Customer Due"
              value={data.kpis.customerDue}
              icon={Users}
              tone="slate"
              trend={0}
              trendLabel="outstanding"
              to="/customers"
            />
            <DashboardKpiCard
              title="Supplier Due"
              value={data.kpis.supplierDue}
              icon={Building2}
              tone="slate"
              trend={0}
              trendLabel="outstanding"
              to="/suppliers"
            />
            {data.kpis.stockValuation != null ? (
              <DashboardKpiCard
                title="Stock Value"
                value={data.kpis.stockValuation}
                icon={Building2}
                tone="green"
                trend={0}
                trendLabel={
                  data.kpis.stockCost != null
                    ? `cost ${formatBDT(data.kpis.stockCost)}`
                    : 'valuation RPC'
                }
                to="/inventory"
              />
            ) : null}
          </div>

          <div className="grid gap-3 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <SalesOverviewChart data={data.salesOverview} />
            </div>
            <div className="lg:col-span-3">
              <SalesChannelChart data={data.channelPerformance} total={data.channelTotal} />
            </div>
            <div className="lg:col-span-3">
              <CourierStatusCard statuses={data.orderStatuses} />
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <TopSellingProductsCard products={data.topProducts} />
            <BranchPerformanceCard branches={data.branchPerformance} />
            <LowStockCard products={data.lowStockProducts} />
          </div>

          <div className="grid gap-3 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <CashFlowChart data={data.cashFlowTrend} />
            </div>
            <div className="lg:col-span-4">
              <AttendanceSummaryCard
                present={data.attendanceToday.present}
                late={data.attendanceToday.late}
                absent={data.attendanceToday.absent}
                leave={data.attendanceToday.leave}
                employees={data.attendanceToday.employees}
              />
            </div>
            <div className="lg:col-span-3">
              <RecentActivityCard activities={data.recentActivity} />
            </div>
          </div>

          <DashboardSectionCard title="Primary Accounts" action={{ label: 'View accounts', to: '/accounts' }}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {data.accounts.map((a) => (
                <div key={a.id} className="rounded-xl bg-[#F8F6F2] px-3 py-3">
                  <p className="text-[11px] text-[#6B7280]">{a.name}</p>
                  <p className="mt-1 text-sm font-semibold text-[#111111]">{formatBDT(a.balance)}</p>
                </div>
              ))}
              {data.accounts.length === 0 && (
                <p className="col-span-full text-sm text-[#6B7280]">No primary accounts configured.</p>
              )}
            </div>
          </DashboardSectionCard>
        </>
      ) : null}
    </div>
  )
}
