import {
  Package,
  CheckCircle,
  Clock,
  XCircle,
  Banknote,
  Wallet,
  TrendingUp,
  Store,
  Truck,
  TrendingDown,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatBDT, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

const iconMap = {
  Package,
  CheckCircle,
  Clock,
  XCircle,
  Banknote,
  Wallet,
  TrendingUp,
  Store,
  Truck,
}

interface KpiCardProps {
  title: string
  value: number
  trend: number
  trend_label: string
  icon: keyof typeof iconMap
  color: string
  isCurrency?: boolean
}

export function KpiCard({ title, value, trend, trend_label, icon, color, isCurrency }: KpiCardProps) {
  const Icon = iconMap[icon]
  const isPositive = trend >= 0

  return (
    <Card className="overflow-hidden">
      <CardContent>
        <div className="flex items-start justify-between gap-2">
          <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', color)}>
            <Icon className="h-4 w-4" />
          </div>
          <div className={cn('flex items-center gap-0.5 text-[10px] font-medium', isPositive ? 'text-success' : 'text-danger')}>
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(trend)}%
          </div>
        </div>
        <p className="mt-2 text-xs text-text-muted">{title}</p>
        <p className="mt-0.5 truncate text-lg font-bold sm:text-xl">
          {isCurrency ? formatBDT(value) : formatNumber(value)}
        </p>
        <p className="mt-0.5 text-[10px] text-text-muted">{trend_label}</p>
      </CardContent>
    </Card>
  )
}
