import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface KpiItem {
  label: string
  value: string | number
  color?: string
}

interface KpiGridProps {
  items: KpiItem[]
  columns?: 2 | 3 | 4 | 5
}

export function KpiGrid({ items, columns = 4 }: KpiGridProps) {
  const colClass =
    columns === 2
      ? 'sm:grid-cols-2'
      : columns === 3
        ? 'sm:grid-cols-3'
        : columns === 5
          ? 'sm:grid-cols-2 lg:grid-cols-5'
          : 'sm:grid-cols-2 lg:grid-cols-4'

  return (
    <div className={cn('grid grid-cols-2 gap-3', colClass)}>
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="text-center">
            <p className="text-xs text-text-muted">{item.label}</p>
            <p className={cn('mt-1 text-lg font-bold', item.color)}>{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
