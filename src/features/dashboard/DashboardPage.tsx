import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Building2,
  Calendar,
  Loader2,
  Package,
  RotateCcw,
  ShoppingBag,
  Store,
  TrendingUp,
  Users,
} from 'lucide-react'
import { AppDateField } from '@/components/date-picker'
import { useAuth } from '@/features/auth/auth.context'
import { queryKeys } from '@/lib/query/keys'
import { addDaysYmd, formatDisplayYmd, startOfMonthYmd, todayYmd } from '@/lib/datetime/bd'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
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
        <div className="flex h-[220px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-hidden />
        </div>
      }
    >
      {children}
    </Suspense>
  )
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

  const { data, isLoading, error, refetch } = useDashboardOverview(branchId)
  const [customPickerOpen, setCustomPickerOpen] = useState(false)

  const salesSpark = data?.salesOverview.map((d) => d.sales) ?? []
  const collectionSpark = data?.salesOverview.map((d) => d.collection) ?? []
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
    setCustomPickerOpen(true)
    setSearchParams(params, { replace: true })
  }

  const effectiveFrom = dateFrom || todayYmd()
  const effectiveTo = dateTo || todayYmd()
  const isSingleToday = effectiveFrom === todayYmd() && effectiveTo === todayYmd()
  const periodLabel =
    effectiveFrom === effectiveTo ? formatDisplayYmd(effectiveFrom) : `${effectiveFrom} → ${effectiveTo}`
  const salesTitle = isSingleToday ? "Today's Sales" : `Sales (${periodLabel})`
  const collectionTitle = isSingleToday ? 'Collection' : `Collection (${periodLabel})`
  const expensesTitle = isSingleToday ? 'Expenses' : `Expenses (${periodLabel})`
  const profitTitle = isSingleToday ? 'Net Profit' : `Net Profit (${periodLabel})`

  function applyPreset(from: string, to: string) {
    const params = new URLSearchParams(searchParams)
    params.set('date_from', from)
    params.set('date_to', to)
    setCustomPickerOpen(false)
    setSearchParams(params, { replace: true })
  }

  function openCustomPicker() {
    setCustomPickerOpen(true)
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

  const showCustomDateFields = customPickerOpen || activePresetId === 'custom'

  const periodChipLabel =
    activePresetId === 'today' || (!dateFrom && !dateTo)
      ? `Today, ${formatDisplayYmd(today)}`
      : activePresetId === 'custom'
        ? periodLabel
        : presets.find((p) => p.id === activePresetId)?.label ?? periodLabel

  if (!profile) {
    return (
      <p className="p-4 text-sm text-slate-500">
        Sign in to load live dashboard metrics from Supabase.
      </p>
    )
  }

  const primaryKpis = data ? (
    <>
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
        to={`/reports/profit${filterSuffix}`}
      />
    </>
  ) : null

  const secondaryKpis = data ? (
    <>
      <DashboardKpiCard
        title="Customer Due"
        value={data.kpis.customerDue}
        icon={Users}
        tone="violet"
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
        tone="violet"
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
        tone="amber"
        valueAsCount
        trendLabel="active catalog"
        to={`/products${filterSuffix}`}
      />
    </>
  ) : null

  return (
    <div className="mx-auto max-w-[1366px] space-y-4 pb-6 [--dash-pink:#E11D48]">
      {/* Mobile branch + period chips */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:hidden">
        <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm">
          <Store className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          <select
            className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-800 outline-none"
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
        </label>
        <div className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 shadow-sm">
          <Calendar className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          <span className="truncate">{periodChipLabel}</span>
        </div>
      </div>

      {/* Desktop / shared filter toolbar */}
      <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
        <div className="hidden lg:block">
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
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              className={cn(
                'h-8 rounded-full border px-3 text-[11px] font-semibold transition',
                activePresetId === p.id && !customPickerOpen
                  ? 'border-[#E11D48] bg-[#E11D48] text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
              )}
              onClick={() => applyPreset(p.from, p.to)}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            className={cn(
              'inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[11px] font-semibold transition',
              showCustomDateFields
                ? 'border-[#E11D48] bg-[#E11D48] text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
            )}
            onClick={openCustomPicker}
            aria-expanded={showCustomDateFields}
            aria-controls="dashboard-custom-dates"
          >
            <Calendar className="h-3 w-3" aria-hidden />
            Custom
          </button>
        </div>

        {showCustomDateFields ? (
          <div
            id="dashboard-custom-dates"
            className="flex flex-wrap items-center gap-1.5"
          >
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
        ) : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Failed to load dashboard metrics.{' '}
          <button type="button" className="font-semibold underline" onClick={() => void refetch()}>
            Retry
          </button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[88px] rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] rounded-2xl" />
            ))}
          </div>
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">{primaryKpis}</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">{secondaryKpis}</div>

          {/* Mid row: Quick Actions (left) + Sales & Collection (right) — height-matched, no stretch gap */}
          <div className="grid items-start gap-3 lg:grid-cols-12">
            <div className="order-2 min-w-0 lg:order-1 lg:col-span-4">
              <QuickActions />
            </div>
            <div className="order-1 min-w-0 lg:order-2 lg:col-span-8">
              <ChartBlock>
                <SalesOverviewChart
                  data={data.salesOverview}
                  error={Boolean(error)}
                  onRetry={() => void refetch()}
                />
              </ChartBlock>
            </div>
          </div>

          {/* Mobile compact link rows */}
          <div className="space-y-2 lg:hidden">
            <RecentSalesTable sales={data.recentActivity} compact />
            <LowStockCard products={data.lowStockProducts} compact />
            <ChartBlock>
              <SalesByCategoryChart
                data={data.salesByCategory}
                total={data.categoryTotal || data.kpis.todaySales}
              />
            </ChartBlock>
          </div>

          {/* Lower three sections — equal fixed columns on desktop */}
          <div className="hidden lg:grid lg:grid-cols-3 lg:gap-3">
            <div className="min-w-0 w-full">
              <RecentSalesTable sales={data.recentActivity} />
            </div>
            <div className="min-w-0 w-full">
              <LowStockCard products={data.lowStockProducts} />
            </div>
            <div className="min-w-0 w-full">
              <ChartBlock>
                <SalesByCategoryChart
                  data={data.salesByCategory}
                  total={data.categoryTotal || data.kpis.todaySales}
                />
              </ChartBlock>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
