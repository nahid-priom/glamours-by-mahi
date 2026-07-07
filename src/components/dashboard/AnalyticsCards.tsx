import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface AnalyticsCardsProps {
  data: { title: string; value: string; subtitle: string; color: string }[]
}

export function AnalyticsCards({ data }: AnalyticsCardsProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle>Analytics Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.map((item) => (
          <div key={item.title} className="rounded-xl border border-border bg-slate-50 p-3">
            <p className="text-xs text-text-muted">{item.title}</p>
            <p className={`mt-0.5 text-lg font-bold ${item.color}`}>{item.value}</p>
            <p className="text-[10px] text-text-muted">{item.subtitle}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
