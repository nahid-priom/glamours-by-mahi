import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

interface StatusDonutProps {
  data: { name: string; value: number; color: string }[]
}

export function StatusDonut({ data }: StatusDonutProps) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-xs font-medium text-text-muted">Live Order Status</p>
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <div className="h-[140px] w-[140px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={60}
                paddingAngle={3}
                dataKey="value"
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => `${v}%`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {data.map((d) => (
            <div key={d.name} className="flex items-center gap-1.5 text-xs">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
              <span className="text-text-muted">{d.name}</span>
              <span className="font-semibold">{d.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

interface OperationsCardProps {
  statusData: { name: string; value: number; color: string }[]
  pickupQueue: { hub: string; count: number }[]
  deliveryProgress: { zone: string; progress: number }[]
}

export function OperationsOverview({ statusData, pickupQueue, deliveryProgress }: OperationsCardProps) {
  const total = pickupQueue.reduce((sum, p) => sum + p.count, 0)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Operations Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-5 lg:grid-cols-3">
          <StatusDonut data={statusData} />

          <div className="min-w-0">
            <p className="mb-2 text-xs font-medium text-text-muted">Pickup Queue</p>
            <div className="space-y-1.5">
              {pickupQueue.map((p) => (
                <div key={p.hub} className="flex items-center justify-between text-xs">
                  <span className="truncate text-text-muted">{p.hub}</span>
                  <span className="ml-2 shrink-0 font-semibold">{p.count}</span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-border pt-1.5 text-xs font-bold">
                <span>Total</span>
                <span className="text-primary">{total.toLocaleString('en-BD')}</span>
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <p className="mb-2 text-xs font-medium text-text-muted">Delivery Progress</p>
            <div className="space-y-2">
              {deliveryProgress.map((d) => (
                <div key={d.zone}>
                  <div className="mb-0.5 flex justify-between text-xs">
                    <span className="truncate text-text-muted">{d.zone}</span>
                    <span className="ml-2 shrink-0 font-semibold">{d.progress}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary-dark to-primary transition-all"
                      style={{ width: `${d.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
