import { useQuery } from '@tanstack/react-query'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { ChartCard } from '@/components/dashboard/ChartCard'
import { OperationsOverview } from '@/components/dashboard/StatusDonut'
import { TopStoresTable } from '@/components/dashboard/TopStoresTable'
import { CourierPerformanceTable } from '@/components/dashboard/CourierPerformanceTable'
import { AnalyticsCards } from '@/components/dashboard/AnalyticsCards'
import { SmartAlerts } from '@/components/dashboard/SmartAlerts'
import { QuickActions } from '@/features/dashboard/components/QuickActions'
import { Skeleton } from '@/components/ui/skeleton'
import { dashboardService } from '@/features/dashboard/dashboard.service'

export function DashboardPage() {
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['dashboard', 'kpis'],
    queryFn: () => dashboardService.getKpis(),
  })

  const { data: cashFlow } = useQuery({
    queryKey: ['dashboard', 'cashFlow'],
    queryFn: () => dashboardService.getCashFlow(),
  })

  const { data: profitTrend } = useQuery({
    queryKey: ['dashboard', 'profitTrend'],
    queryFn: () => dashboardService.getProfitTrend(),
  })

  const { data: balances } = useQuery({
    queryKey: ['dashboard', 'balances'],
    queryFn: () => dashboardService.getBalances(),
  })

  const { data: orderStatus } = useQuery({
    queryKey: ['dashboard', 'orderStatus'],
    queryFn: () => dashboardService.getOrderStatus(),
  })

  const { data: pickupQueue } = useQuery({
    queryKey: ['dashboard', 'pickupQueue'],
    queryFn: () => dashboardService.getPickupQueue(),
  })

  const { data: deliveryProgress } = useQuery({
    queryKey: ['dashboard', 'deliveryProgress'],
    queryFn: () => dashboardService.getDeliveryProgress(),
  })

  const { data: topStores } = useQuery({
    queryKey: ['dashboard', 'topStores'],
    queryFn: () => dashboardService.getTopStores(),
  })

  const { data: courierPerf } = useQuery({
    queryKey: ['dashboard', 'courierPerf'],
    queryFn: () => dashboardService.getCourierPerformance(),
  })

  const { data: alerts } = useQuery({
    queryKey: ['dashboard', 'alerts'],
    queryFn: () => dashboardService.getSmartAlerts(),
  })

  const { data: analytics } = useQuery({
    queryKey: ['dashboard', 'analytics'],
    queryFn: () => dashboardService.getAnalyticsCards(),
  })

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {kpisLoading
          ? Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-[110px]" />
            ))
          : kpis?.map((kpi) => (
              <KpiCard
                key={kpi.id}
                title={kpi.title}
                value={kpi.value}
                trend={kpi.trend}
                trend_label={kpi.trend_label}
                icon={kpi.icon as 'Package'}
                color={kpi.color}
                isCurrency={'isCurrency' in kpi ? kpi.isCurrency : false}
              />
            ))}
      </div>

      <QuickActions />

      {cashFlow && profitTrend && balances && (
        <ChartCard cashFlow={cashFlow} profitTrend={profitTrend} balances={balances} />
      )}

      {orderStatus && pickupQueue && deliveryProgress && (
        <OperationsOverview
          statusData={orderStatus}
          pickupQueue={pickupQueue}
          deliveryProgress={deliveryProgress}
        />
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {topStores && <TopStoresTable data={topStores} />}
        {courierPerf && <CourierPerformanceTable data={courierPerf} />}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {analytics && <AnalyticsCards data={analytics} />}
        {alerts && <SmartAlerts data={alerts} />}
      </div>
    </div>
  )
}
