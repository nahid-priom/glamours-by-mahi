import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatBDT } from '@/lib/format'
import { DashboardSectionCard } from './DashboardSectionCard'

interface SalesOverviewChartProps {
  data: { label: string; sales: number; collection: number }[]
}

export function SalesOverviewChart({ data }: SalesOverviewChartProps) {
  return (
    <DashboardSectionCard title="Sales Overview" action={{ label: 'View reports', to: '/reports/sales' }}>
      <p className="mb-3 text-[11px] text-[#6B7280]">Sales vs Collection · Last 7 days</p>
      <div className="h-[260px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={4} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 10, fill: '#6B7280' }}
              axisLine={false}
              tickLine={false}
              width={48}
              tickFormatter={(v) => `${Math.round(v / 1000)}k`}
            />
            <Tooltip
              formatter={(value) => formatBDT(Number(value ?? 0))}
              contentStyle={{ borderRadius: 12, border: '1px solid #E5E7EB', fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="sales" name="Sales" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar dataKey="collection" name="Collection" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </DashboardSectionCard>
  )
}
