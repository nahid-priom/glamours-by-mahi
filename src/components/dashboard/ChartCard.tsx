import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatBDT } from '@/lib/format'
import type { ChartDataPoint } from '@/types'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'

interface ChartCardProps {
  cashFlow: ChartDataPoint[]
  profitTrend: ChartDataPoint[]
  balances: { label: string; amount: number; color: string }[]
}

export function ChartCard({ cashFlow, profitTrend, balances }: ChartCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Finance Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {balances.map((b) => (
            <div key={b.label} className="rounded-xl border border-border bg-slate-50 p-2.5 text-center">
              <p className="text-[10px] text-text-muted">{b.label}</p>
              <p className={`mt-0.5 text-xs font-bold sm:text-sm ${b.color}`}>
                {formatBDT(b.amount)}
              </p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="min-w-0">
            <p className="mb-2 text-xs font-medium text-text-muted">Daily Cash Flow</p>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cashFlow} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => formatBDT(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="cashIn" name="Cash In" fill="#22C55E" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cashOut" name="Cash Out" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="min-w-0">
            <p className="mb-2 text-xs font-medium text-text-muted">Profit Trend</p>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={profitTrend} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => formatBDT(Number(v))} />
                  <Line type="monotone" dataKey="profit" name="Profit" stroke="#E11D48" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
