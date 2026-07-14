import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { formatBDT } from '@/lib/format'
import { DashboardSectionCard } from './DashboardSectionCard'

const COLORS = ['#111111', '#E11D48', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6']

interface SalesChannelChartProps {
  data: { channel: string; sales: number; count: number }[]
  total: number
}

export function SalesChannelChart({ data, total }: SalesChannelChartProps) {
  const chartData = data.filter((d) => d.sales > 0)

  return (
    <DashboardSectionCard title="Sales by Channel">
      <div className="relative mx-auto h-[160px] w-full max-w-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="sales"
              nameKey="channel"
              innerRadius={48}
              outerRadius={72}
              paddingAngle={2}
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => formatBDT(Number(value ?? 0))} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[10px] uppercase tracking-wide text-[#6B7280]">Total</p>
          <p className="text-sm font-bold text-[#111111]">{formatBDT(total)}</p>
        </div>
      </div>
      <ul className="mt-3 space-y-1.5">
        {data.map((row, i) => {
          const pct = total > 0 ? Math.round((row.sales / total) * 100) : 0
          return (
            <li key={row.channel} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                <span className="truncate text-[#6B7280]">{row.channel}</span>
              </span>
              <span className="shrink-0 font-medium text-[#111111]">
                {pct}% · {formatBDT(row.sales)}
              </span>
            </li>
          )
        })}
      </ul>
    </DashboardSectionCard>
  )
}
