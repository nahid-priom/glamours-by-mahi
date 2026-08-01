import { lazy, Suspense, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Building2,
  Loader2,
  Package,
  RotateCcw,
  ShoppingBag,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import { useAuth } from '@/features/auth/auth.context'
import { formatBDT } from '@/lib/format'
import { queryKeys } from '@/lib/query/keys'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardKpiCard } from './components/DashboardKpiCard'
import { CourierStatusCard } from './components/CourierStatusCard'
import { TopSellingProductsCard } from './components/TopSellingProductsCard'
import { BranchPerformanceCard } from './components/BranchPerformanceCard'
import { LowStockCard } from './components/LowStockCard'
import { AttendanceSummaryCard } from './components/AttendanceSummaryCard'
import { RecentActivityCard } from './components/RecentActivityCard'
import { DashboardSectionCard } from './components/DashboardSectionCard'
import { useDashboardOverview } from './hooks/use-dashboard-overview'
import { listDashboardBranches } from './repositories/dashboard.repository'

const SalesOverviewChart = lazy(() =>
  import('./components/SalesOverviewChart').then((m) => ({ default: m.SalesOverviewChart })),
)
const SalesChannelChart = lazy(() =>
  import('./components/SalesChannelChart').then((m) => ({ default: m.SalesChannelChart })),
)
const CashFlowChart = lazy(() =>
  import('./components/CashFlowChart').then((m) => ({ default: m.CashFlowChart })),
)

function ChartBlock({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-[260px] items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white">
          <Loader2 className="h-6 w-6 animate-spin text-[#6B7280]" aria-hidden />
        </div>
      }
    >
      {children}
    </Suspense>
  )
}

function KpiSkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-[88px] rounded-xl" />
      ))}
    </div>
  )
}

function buildFilterQuery(branchId: string, dateFrom: string | null, dateTo: string | null) {
  const params = new URLSearchParams()
  if (branchId) params.set('branch_id', branchId)
  if (dateFrom) params.set('date_from', dateFrom)
  if (dateTo) params.set('date_to', dateTo)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export function DashboardPage() {
  const { profile, activeBranchId, setActiveBranchId } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const branchId = searchParams.get('branch_id') ?? activeBranchId ?? ''
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')

  useEffect(() => {
    const urlBranch = searchParams.get('branch_id')
    if (urlBranch && urlBranch !== activeBranchId) {
      setActiveBranchId(urlBranch)
    }
  }, [searchParams, activeBranchId, setActiveBranchId])

  const filterSuffix = useMemo(
    () => buildFilterQuery(branchId, dateFrom, dateTo),
    [branchId, dateFrom, dateTo],
  )

  const { data: branches = [] } = useQuery({
    queryKey: queryKeys.dashboardBranches,
    queryFn: listDashboardBranches,
    enabled: Boolean(profile),
  })

  const { data, isLoading, error, dataUpdatedAt, isFetching } = useDashboardOverview(branchId)

  const salesSpark = data?.salesOverview.map((d) => d.sales) ?? []
  const collectionSpark = data?.salesOverview.map((d) => d.collection) ?? []

  function onBranchChange(next: string) {
    setActiveBranchId(next || null)
    const params = new URLSearchParams(searchParams)
    if (next) params.set('branch_id', next)
    else params.delete('branch_id')
    setSearchParams(params, { replace: true })
  }

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
            onChange={(e) => onBranchChange(e.target.value)}
            aria-label="Filter dashboard by branch"
          >
            <option value="">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <span className="rounded-full border border-[#E5E7EB] bg-white px-3 py-2 text-[11px] text-[#6B7280]">
            {isFetching ? 'Refreshing…' : 'Live Supabase'}
            {data?.refreshedAt || dataUpdatedAt ? (
              <> · {new Date(data?.refreshedAt ?? dataUpdatedAt).toLocaleTimeString()}</>
            ) : null}
          </span>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-[#E11D48]">Failed to load dashboard metrics.</p>
      ) : null}

      {isLoading ? <KpiSkeletonGrid /> : null}

      {data ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
            <DashboardKpiCard
              title="Today's Sales"
              value={data.kpis.todaySales}
              icon={Banknote}
              tone="rose"
              trend={data.kpis.trends.sales}
              sparkline={salesSpark}
              to={`/sales${filterSuffix}`}
            />
            <DashboardKpiCard
              title="Today's Collection"
              value={data.kpis.todayCollection}
              icon={ArrowDownRight}
              tone="green"
              trend={data.kpis.trends.collection}
              sparkline={collectionSpark}
              to={`/sales/collections${filterSuffix}`}
            />
            <DashboardKpiCard
              title="Today's Expenses"
              value={data.kpis.todayExpenses}
              icon={ArrowUpRight}
              tone="amber"
              trend={data.kpis.trends.expenses}
              to={`/accounts/expenses${filterSuffix}`}
            />
            <DashboardKpiCard
              title="Net Cash Flow"
              value={data.kpis.netCashFlow}
              icon={Wallet}
              tone="blue"
              trend={data.kpis.trends.netCashFlow}
              to={`/accounts${filterSuffix}`}
            />
            <DashboardKpiCard
              title="Customer Due"
              value={data.kpis.customerDue}
              icon={Users}
              tone="slate"
              trend={0}
              trendLabel="outstanding"
              to={`/customers?due=1${filterSuffix ? `&${filterSuffix.slice(1)}` : ''}`}
            />
            <DashboardKpiCard
              title="Supplier Due"
              value={data.kpis.supplierDue}
              icon={Building2}
              tone="slate"
              trend={0}
              trendLabel="outstanding"
              to={`/suppliers?due=1${filterSuffix ? `&${filterSuffix.slice(1)}` : ''}`}
            />
            <DashboardKpiCard
              title="Low Stock"
              value={data.kpis.lowStockCount}
              icon={Package}
              tone="amber"
              trend={0}
              trendLabel="items"
              to={`/inventory/low-stock${filterSuffix}`}
            />
            {data.kpis.onlineOrders != null ? (
              <DashboardKpiCard
                title="Online Orders"
                value={data.kpis.onlineOrders}
                icon={ShoppingBag}
                tone="blue"
                trend={0}
                trendLabel="in range"
                to={`/sales/online-orders${filterSuffix}`}
              />
            ) : null}
            {data.kpis.returnsToday != null ? (
              <DashboardKpiCard
                title="Returns"
                value={data.kpis.returnsToday}
                icon={RotateCcw}
                tone="rose"
                trend={0}
                trendLabel="in range"
                to={`/sales/returns${filterSuffix}`}
              />
            ) : null}
            {data.kpis.profitToday != null ? (
              <DashboardKpiCard
                title="Profit"
                value={data.kpis.profitToday}
                icon={TrendingUp}
                tone="green"
                trend={0}
                trendLabel="collection − expenses"
                to={`/reports/profit${filterSuffix}`}
              />
            ) : null}
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
                    : 'valuation'
                }
                to={`/inventory${filterSuffix}`}
              />
            ) : null}
          </div>

          <div className="grid gap-3 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <ChartBlock>
                <SalesOverviewChart data={data.salesOverview} />
              </ChartBlock>
            </div>
            <div className="lg:col-span-3">
              <ChartBlock>
                <SalesChannelChart data={data.channelPerformance} total={data.channelTotal} />
              </ChartBlock>
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
              <ChartBlock>
                <CashFlowChart data={data.cashFlowTrend} />
              </ChartBlock>
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
