import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatBDT } from '@/lib/format'
import { DashboardSectionCard } from '@/features/dashboard/components/DashboardSectionCard'

const COLORS = ['#111111', '#E11D48', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#64748B']

interface SalesAnalyticsRowProps {
  trend: { label: string; sales: number; collections: number; returns: number }[]
  byChannel: { channel: string; sales: number }[]
  byPayment: { method: string; amount: number }[]
}

export function SalesAnalyticsRow({ trend, byChannel, byPayment }: SalesAnalyticsRowProps) {
  const channelTotal = byChannel.reduce((s, x) => s + x.sales, 0)
  const paymentTotal = byPayment.reduce((s, x) => s + x.amount, 0)

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <DashboardSectionCard title="Sales Trend">
          <p className="mb-2 text-[11px] text-[#6B7280]">Sales · Collections · Returns</p>
          <div className="h-[220px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} barGap={2} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 10, fill: '#6B7280' }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                  tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                />
                <Tooltip
                  formatter={(value) => formatBDT(Number(value ?? 0))}
                  contentStyle={{ borderRadius: 12, border: '1px solid #E5E7EB', fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="sales" name="Sales" fill="#3B82F6" radius={[3, 3, 0, 0]} maxBarSize={14} />
                <Bar dataKey="collections" name="Collections" fill="#10B981" radius={[3, 3, 0, 0]} maxBarSize={14} />
                <Bar dataKey="returns" name="Returns" fill="#E11D48" radius={[3, 3, 0, 0]} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DashboardSectionCard>
      </div>

      <DonutCard title="Sales By Channel" data={byChannel.map((d) => ({ name: d.channel, value: d.sales }))} total={channelTotal} />
      <DonutCard title="Payment Method Distribution" data={byPayment.map((d) => ({ name: d.method, value: d.amount }))} total={paymentTotal} />
    </div>
  )
}

function DonutCard({
  title,
  data,
  total,
}: {
  title: string
  data: { name: string; value: number }[]
  total: number
}) {
  const filtered = data.filter((d) => d.value > 0)
  return (
    <DashboardSectionCard title={title}>
      <div className="relative mx-auto h-[160px] w-full max-w-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={filtered} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2}>
              {filtered.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => formatBDT(Number(value ?? 0))} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[10px] uppercase tracking-wide text-[#6B7280]">Total</p>
          <p className="text-sm font-bold">{formatBDT(total)}</p>
        </div>
      </div>
      <ul className="mt-3 max-h-28 space-y-1.5 overflow-y-auto">
        {data.map((row, i) => {
          const pct = total > 0 ? Math.round((row.value / total) * 100) : 0
          return (
            <li key={row.name} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="truncate text-[#6B7280]">{row.name}</span>
              </span>
              <span className="shrink-0 font-medium">{pct}%</span>
            </li>
          )
        })}
      </ul>
    </DashboardSectionCard>
  )
}
