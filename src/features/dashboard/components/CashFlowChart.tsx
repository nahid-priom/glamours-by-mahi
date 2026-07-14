import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatBDT } from '@/lib/format'
import { DashboardSectionCard } from './DashboardSectionCard'

interface CashFlowChartProps {
  data: { label: string; income: number; expense: number; profit: number }[]
}

export function CashFlowChart({ data }: CashFlowChartProps) {
  return (
    <DashboardSectionCard title="Cash Flow Trend" action={{ label: 'View accounts', to: '/accounts' }}>
      <p className="mb-3 text-[11px] text-[#6B7280]">Income · Expense · Profit · This month</p>
      <div className="h-[240px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} />
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
            <Line type="monotone" dataKey="income" name="Income" stroke="#10B981" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="expense" name="Expense" stroke="#E11D48" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="profit" name="Profit" stroke="#3B82F6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </DashboardSectionCard>
  )
}
