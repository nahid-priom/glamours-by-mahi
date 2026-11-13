import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { formatBDT } from '@/lib/format'
import { DashboardSectionCard } from './DashboardSectionCard'

const COLORS = ['#E11D48', '#F97316', '#3B82F6', '#10B981', '#8B5CF6', '#64748B', '#EC4899']

export type CategorySalesRow = {
  category: string
  sales: number
  count?: number
  percent?: number
}

interface SalesByCategoryChartProps {
  data: CategorySalesRow[]
  total: number
}

export function SalesByCategoryChart({ data, total }: SalesByCategoryChartProps) {
  const chartData = data.filter((d) => d.sales > 0)

  return (
    <DashboardSectionCard title="Sales by Category">
      {chartData.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">No category sales in this period.</p>
      ) : (
        <>
          <div className="relative mx-auto h-[180px] w-full max-w-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="sales"
                  nameKey="category"
                  innerRadius={52}
                  outerRadius={78}
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
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Total Sales</p>
              <p className="text-sm font-bold text-slate-900">{formatBDT(total)}</p>
            </div>
          </div>
          <ul className="mt-3 space-y-1.5">
            {data.map((row, i) => {
              const pct =
                typeof row.percent === 'number'
                  ? row.percent
                  : total > 0
                    ? Math.round((row.sales / total) * 1000) / 10
                    : 0
              return (
                <li key={row.category} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    <span className="truncate text-slate-500">{row.category}</span>
                  </span>
                  <span className="shrink-0 font-medium text-slate-900">
                    {pct}% · {formatBDT(row.sales)}
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </DashboardSectionCard>
  )
}
