import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { OrderAutomationStatus } from '@/types'
import { cn } from '@/lib/utils'

const statusColors: Record<string, string> = {
  New: 'border-blue-200 bg-blue-50 text-blue-700',
  Confirmed: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  Packed: 'border-purple-200 bg-purple-50 text-purple-700',
  'Courier Booked': 'border-cyan-200 bg-cyan-50 text-cyan-700',
  Delivered: 'border-green-200 bg-green-50 text-green-700',
  Returned: 'border-orange-200 bg-orange-50 text-orange-700',
  Cancelled: 'border-slate-200 bg-slate-50 text-slate-600',
  'High Fraud Risk': 'border-red-200 bg-red-50 text-red-700',
}

interface OrderAutomationStripProps {
  data: OrderAutomationStatus[]
}

export function OrderAutomationStrip({ data }: OrderAutomationStripProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Order Automation Pipeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {data.map((item) => (
            <div
              key={item.status}
              className={cn(
                'flex min-w-[100px] shrink-0 flex-col items-center rounded-xl border p-2.5 text-center',
                statusColors[item.status] ?? 'border-border bg-slate-50',
              )}
            >
              <span className="text-lg font-bold">{item.count.toLocaleString('en-BD')}</span>
              <span className="mt-0.5 text-[10px] font-medium leading-tight">{item.status}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
