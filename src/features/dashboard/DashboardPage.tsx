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
} from 'lucide-react'
import { AppDateField } from '@/components/date-picker'
import { useAuth } from '@/features/auth/auth.context'
import { queryKeys } from '@/lib/query/keys'
import { addDaysYmd, startOfMonthYmd, todayYmd } from '@/lib/datetime/bd'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardKpiCard } from './components/DashboardKpiCard'
import { LowStockCard } from './components/LowStockCard'
import { QuickActions } from './components/QuickActions'
import { RecentSalesTable } from './components/RecentSalesTable'
import { useDashboardOverview } from './hooks/use-dashboard-overview'
import { listDashboardBranches } from './repositories/dashboard.repository'

const SalesOverviewChart = lazy(() =>
  import('./components/SalesOverviewChart').then((m) => ({ default: m.SalesOverviewChart })),
)
const SalesByCategoryChart = lazy(() =>
  import('./components/SalesByCategoryChart').then((m) => ({ default: m.SalesByCategoryChart })),
)

function ChartBlock({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-[280px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-hidden />
        </div>
      }
    >
      {children}
    </Suspense>
  )
}

function greetingForNow(d = new Date()) {
  const h = d.getHours()
  if (h < 12) return 'Good Morning'
  if (h < 17) return 'Good Afternoon'
  return 'Good Evening'
}

/** Hide fabricated 0% trends when both current value and reported delta are zero. */
function meaningfulTrend(trend: number | null | undefined, current: number): number | null {
  if (trend == null || !Number.isFinite(trend)) return null
  if (trend === 0 && current === 0) return null
  return trend
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
  const firstName = profile?.full_name?.split(/\s+/)[0] ?? 'there'
  const todayLabel = new Date().toLocaleDateString('en-BD', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Dhaka',
  })

  function onBranchChange(next: string) {
    setActiveBranchId(next || null)
    const params = new URLSearchParams(searchParams)
    if (next) params.set('branch_id', next)
    else params.delete('branch_id')
    setSearchParams(params, { replace: true })
  }

  function onDateChange(key: 'date_from' | 'date_to', value: string) {
    const params = new URLSearchParams(searchParams)
    if (value) params.set(key, value)
    else params.delete(key)
    setSearchParams(params, { replace: true })
  }

  const effectiveFrom = dateFrom || todayYmd()
  const effectiveTo = dateTo || todayYmd()
  const isSingleToday = effectiveFrom === todayYmd() && effectiveTo === todayYmd()
  const periodLabel =
    effectiveFrom === effectiveTo ? effectiveFrom : `${effectiveFrom} → ${effectiveTo}`
  const salesTitle = isSingleToday ? "Today's Sales" : `Sales (${periodLabel})`
  const collectionTitle = isSingleToday ? "Today's Collection" : `Collection (${periodLabel})`
  const expensesTitle = isSingleToday ? "Today's Expenses" : `Expenses (${periodLabel})`
  const profitTitle = isSingleToday ? "Today's Net Profit" : `Net Profit (${periodLabel})`

  const rangeLabel =
    dateFrom || dateTo
      ? `${dateFrom ?? '…'} → ${dateTo ?? '…'}`
      : `Today, ${todayLabel}`

  function applyPreset(from: string, to: string) {
    const params = new URLSearchParams(searchParams)
    params.set('date_from', from)
    params.set('date_to', to)
    setSearchParams(params, { replace: true })
  }

  const today = todayYmd()
  const yesterday = addDaysYmd(today, -1)
  const last7From = addDaysYmd(today, -6)
  const thisMonthFrom = startOfMonthYmd(today)
  const lastMonthEnd = addDaysYmd(thisMonthFrom, -1)
  const lastMonthFrom = startOfMonthYmd(lastMonthEnd)

  const presets: Array<{ id: string; label: string; from: string; to: string }> = [
    { id: 'today', label: 'Today', from: today, to: today },
    { id: 'yesterday', label: 'Yesterday', from: yesterday, to: yesterday },
    { id: 'last7', label: 'Last 7 Days', from: last7From, to: today },
    { id: 'thisMonth', label: 'This Month', from: thisMonthFrom, to: today },
    { id: 'lastMonth', label: 'Last Month', from: lastMonthFrom, to: lastMonthEnd },
  ]

  const activePresetId =
    presets.find((p) => dateFrom === p.from && dateTo === p.to)?.id ??
    (dateFrom || dateTo ? 'custom' : 'today')

  if (!profile) {
    return (
      <p className="p-4 text-sm text-slate-500">Sign in to load live dashboard metrics from Supabase.</p>
    )
  }

  return (
    <div className="mx-auto max-w-[1366px] space-y-4 pb-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[1.45rem] font-bold tracking-tight text-slate-900 sm:text-[1.6rem]">
            {greetingForNow()}, {firstName}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">Glamorous Gallery By Mahi</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800"
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
          <div className="flex max-w-full flex-col gap-1.5">
            <div className="flex flex-wrap gap-1">
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`h-8 rounded-xl border px-2.5 text-[11px] font-medium ${
                    activePresetId === p.id
                      ? 'border-[#E11D48] bg-[#FFF1F2] text-[#E11D48]'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                  onClick={() => applyPreset(p.from, p.to)}
                >
                  {p.label}
                </button>
              ))}
              <span
                className={`flex h-8 items-center rounded-xl border px-2.5 text-[11px] font-medium ${
                  activePresetId === 'custom'
                    ? 'border-[#E11D48] bg-[#FFF1F2] text-[#E11D48]'
                    : 'border-slate-200 bg-white text-slate-500'
                }`}
              >
                Custom
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <AppDateField
                value={dateFrom ?? ''}
                onChange={(v) => onDateChange('date_from', v)}
                aria-label="Dashboard date from"
              />
              <span className="text-[11px] text-slate-400">→</span>
              <AppDateField
                value={dateTo ?? ''}
                onChange={(v) => onDateChange('date_to', v)}
                aria-label="Dashboard date to"
              />
            </div>
          </div>
          <span className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-500">
            {rangeLabel}
          </span>
          <span className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-500">
            {isFetching ? 'Refreshing…' : 'Live'}
            {data?.refreshedAt || dataUpdatedAt ? (
              <> · {new Date(data?.refreshedAt ?? dataUpdatedAt).toLocaleTimeString()}</>
            ) : null}
          </span>
        </div>
      </header>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Failed to load dashboard metrics. Retry or check permissions.
        </div>
      ) : null}

      {isLoading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[120px] rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[88px] rounded-2xl" />
            ))}
          </div>
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DashboardKpiCard
              size="primary"
              title={salesTitle}
              value={data.kpis.todaySales}
              icon={Banknote}
              tone="rose"
              trend={meaningfulTrend(data.kpis.trends.sales, data.kpis.todaySales)}
              sparkline={salesSpark}
              to={`/sales${filterSuffix}`}
            />
            <DashboardKpiCard
              size="primary"
              title={collectionTitle}
              value={data.kpis.todayCollection}
              icon={ArrowDownRight}
              tone="green"
              trend={meaningfulTrend(data.kpis.trends.collection, data.kpis.todayCollection)}
              sparkline={collectionSpark}
              to={`/sales/collections${filterSuffix}`}
            />
            <DashboardKpiCard
              size="primary"
              title={expensesTitle}
              value={data.kpis.todayExpenses}
              icon={ArrowUpRight}
              tone="amber"
              trend={meaningfulTrend(data.kpis.trends.expenses, data.kpis.todayExpenses)}
              to={`/accounts/expenses${filterSuffix}`}
            />
            <DashboardKpiCard
              size="primary"
              title={profitTitle}
              value={data.kpis.profitToday ?? 0}
              icon={TrendingUp}
              tone="blue"
              trend={meaningfulTrend(data.kpis.trends.profit, data.kpis.profitToday ?? 0)}
              trendLabel="gross − expenses"
              to={`/reports/profit${filterSuffix}`}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <DashboardKpiCard
              title="Customer Due"
              value={data.kpis.customerDue}
              icon={Users}
              tone="slate"
              trendLabel="current balance"
              to={`/customers?due=1${filterSuffix ? `&${filterSuffix.slice(1)}` : ''}`}
            />
            <DashboardKpiCard
              title="Supplier Due"
              value={data.kpis.supplierDue}
              icon={Building2}
              tone="slate"
              trendLabel="current balance"
              to={`/suppliers?due=1${filterSuffix ? `&${filterSuffix.slice(1)}` : ''}`}
            />
            <DashboardKpiCard
              title="Low Stock"
              value={data.kpis.lowStockCount}
              icon={Package}
              tone="amber"
              valueAsCount
              trendLabel="current"
              to={`/inventory/low-stock${filterSuffix}`}
            />
            <DashboardKpiCard
              title="Online Orders"
              value={data.kpis.onlineOrders ?? 0}
              icon={ShoppingBag}
              tone="blue"
              valueAsCount
              trendLabel="in range"
              to={`/sales/online-orders${filterSuffix}`}
            />
            <DashboardKpiCard
              title="Returns"
              value={data.kpis.returnsToday ?? 0}
              icon={RotateCcw}
              tone="rose"
              valueAsCount
              trendLabel="in range"
              to={`/sales/returns${filterSuffix}`}
            />
            <DashboardKpiCard
              title="Total Products"
              value={data.kpis.totalProducts ?? 0}
              icon={Package}
              tone="slate"
              valueAsCount
              trendLabel="active catalog"
              to={`/products${filterSuffix}`}
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <ChartBlock>
                <SalesOverviewChart data={data.salesOverview} />
              </ChartBlock>
            </div>
            <div className="lg:col-span-4">
              <ChartBlock>
                <SalesByCategoryChart
                  data={
                    data.salesByCategory.length
                      ? data.salesByCategory
                      : data.channelPerformance.map((c) => ({
                          category: c.channel,
                          sales: c.sales,
                          count: c.count,
                          percent:
                            data.channelTotal > 0
                              ? Math.round((c.sales / data.channelTotal) * 1000) / 10
                              : 0,
                        }))
                  }
                  total={data.categoryTotal || data.channelTotal || data.kpis.todaySales}
                />
              </ChartBlock>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-12">
            <div className="min-w-0 lg:col-span-5">
              <RecentSalesTable sales={data.recentActivity} />
            </div>
            <div className="min-w-0 lg:col-span-4">
              <LowStockCard products={data.lowStockProducts} />
            </div>
            <div className="min-w-0 lg:col-span-3">
              <QuickActions />
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
