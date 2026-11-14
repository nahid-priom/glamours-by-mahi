import { BarChart3 } from 'lucide-react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatBDT } from '@/lib/format'
import { DashboardSectionCard } from './DashboardSectionCard'

interface SalesOverviewChartProps {
  data: { label: string; sales: number; collection: number }[]
  /** When true, show error UI instead of empty/chart */
  error?: boolean
  onRetry?: () => void
}

export function SalesOverviewChart({ data, error, onRetry }: SalesOverviewChartProps) {
  const hasSeries = data.some((d) => Number(d.sales) > 0 || Number(d.collection) > 0)

  return (
    <DashboardSectionCard
      className="h-auto"
      bodyClassName="!flex-none space-y-2"
      title="Sales & Collection Overview"
      action={{ label: 'View reports', to: '/reports/sales' }}
    >
      <div className="flex items-center gap-2 text-[11px] text-[#6B7280]">
        <BarChart3 className="h-3.5 w-3.5 text-[#E11D48]" aria-hidden />
        <span>Sales vs Collection</span>
      </div>

      {error ? (
        <div className="flex h-[128px] flex-col items-center justify-center gap-2 rounded-xl border border-rose-100 bg-rose-50/50 px-4 text-center">
          <p className="text-sm font-medium text-rose-700">Could not load chart data.</p>
          {onRetry ? (
            <button
              type="button"
              className="text-xs font-semibold text-[#E11D48] underline"
              onClick={onRetry}
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : !hasSeries ? (
        <div className="relative flex h-[128px] flex-col items-center justify-center overflow-hidden rounded-xl border border-[#FCE7F3] bg-gradient-to-b from-white to-[#FFF1F2]">
          <BarChart3 className="h-9 w-9 text-[#F9A8D4]" strokeWidth={1.25} aria-hidden />
          <p className="mt-1.5 text-sm font-medium text-slate-600">No sales data in this period.</p>
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-[radial-gradient(ellipse_at_bottom,_rgba(225,29,72,0.12),_transparent_70%)]"
            aria-hidden
          />
        </div>
      ) : (
        <div className="h-[128px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="dashSalesFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E11D48" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#E11D48" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="dashCollectFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#6B7280' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#6B7280' }}
                axisLine={false}
                tickLine={false}
                width={48}
                tickFormatter={(v) =>
                  Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : String(v)
                }
              />
              <Tooltip
                formatter={(value) => formatBDT(Number(value ?? 0))}
                contentStyle={{ borderRadius: 12, border: '1px solid #E5E7EB', fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area
                type="monotone"
                dataKey="sales"
                name="Sales"
                stroke="transparent"
                fill="url(#dashSalesFill)"
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="collection"
                name="Collection"
                stroke="transparent"
                fill="url(#dashCollectFill)"
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="sales"
                name="Sales"
                stroke="#E11D48"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#E11D48', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="collection"
                name="Collection"
                stroke="#3B82F6"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#3B82F6', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashboardSectionCard>
  )
}
