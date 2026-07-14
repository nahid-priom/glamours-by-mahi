import {
  Banknote,
  RotateCcw,
  ShoppingBag,
  TrendingUp,
  Wallet,
  CircleDollarSign,
} from 'lucide-react'
import { DashboardKpiCard } from '@/features/dashboard/components/DashboardKpiCard'

interface SalesKpiRowProps {
  todaySales: number
  todayTrend: number
  monthSales: number
  collections: number
  outstandingDue: number
  returns: number
  averageOrderValue: number
}

export function SalesKpiRow(props: SalesKpiRowProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <DashboardKpiCard
        title="Today's Sales"
        value={props.todaySales}
        icon={ShoppingBag}
        tone="rose"
        trend={props.todayTrend}
        trendLabel="vs yesterday"
      />
      <DashboardKpiCard
        title="This Month Sales"
        value={props.monthSales}
        icon={TrendingUp}
        tone="blue"
        trend={0}
        trendLabel="this month"
      />
      <DashboardKpiCard
        title="Collections"
        value={props.collections}
        icon={Banknote}
        tone="green"
        trend={0}
        trendLabel="collected"
      />
      <DashboardKpiCard
        title="Outstanding Due"
        value={props.outstandingDue}
        icon={Wallet}
        tone="amber"
        trend={0}
        trendLabel="receivable"
      />
      <DashboardKpiCard
        title="Returns"
        value={props.returns}
        icon={RotateCcw}
        tone="slate"
        trend={0}
        trendLabel="this month"
      />
      <DashboardKpiCard
        title="Average Order Value"
        value={props.averageOrderValue}
        icon={CircleDollarSign}
        tone="blue"
        trend={0}
        trendLabel="AOV"
      />
    </div>
  )
}
