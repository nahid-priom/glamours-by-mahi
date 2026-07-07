import { Card, CardContent } from '@/components/ui/card'
import type { ReportSummary } from '../reports.types'
import { cn } from '@/lib/utils'

export function ReportSummaryCards({ summary }: { summary: ReportSummary[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {summary.map((s) => (
        <Card key={s.label}>
          <CardContent className="text-center">
            <p className="text-xs text-text-muted">{s.label}</p>
            <p className={cn('mt-1 text-lg font-bold', s.color)}>{s.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
