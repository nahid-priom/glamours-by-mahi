import { AlertTriangle, Info, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { SmartAlert } from '@/types'
import { cn } from '@/lib/utils'

interface SmartAlertsProps {
  data: SmartAlert[]
}

const alertStyles = {
  warning: { icon: AlertTriangle, bg: 'bg-amber-50 border-amber-200', text: 'text-warning' },
  danger: { icon: AlertCircle, bg: 'bg-red-50 border-red-200', text: 'text-danger' },
  info: { icon: Info, bg: 'bg-blue-50 border-blue-200', text: 'text-blue-600' },
}

export function SmartAlerts({ data }: SmartAlertsProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle>Smart Alerts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.map((alert) => {
          const style = alertStyles[alert.type]
          const Icon = style.icon
          return (
            <div
              key={alert.id}
              className={cn('flex gap-2.5 rounded-xl border p-2.5', style.bg)}
            >
              <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', style.text)} />
              <div className="min-w-0">
                <p className="text-xs font-semibold">{alert.title}</p>
                <p className="text-[10px] text-text-muted">{alert.description}</p>
                <p className="mt-0.5 text-[10px] text-text-muted">{alert.time}</p>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
