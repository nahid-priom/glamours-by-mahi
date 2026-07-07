import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CourierPerformanceRow } from '@/types'
import { Star } from 'lucide-react'

interface CourierPerformanceTableProps {
  data: CourierPerformanceRow[]
}

export function CourierPerformanceTable({ data }: CourierPerformanceTableProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle>Courier Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left text-text-muted">
                <th className="pb-2 font-medium">Courier/Rider</th>
                <th className="pb-2 font-medium">Deliveries</th>
                <th className="pb-2 font-medium">Success Rate</th>
                <th className="pb-2 font-medium">Rating</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.courier} className="border-b border-border/50">
                  <td className="py-2 font-medium">{row.courier}</td>
                  <td className="py-2">{row.deliveries.toLocaleString('en-BD')}</td>
                  <td className="py-2">
                    <span className={row.success_rate >= 95 ? 'text-success' : 'text-warning'}>
                      {row.success_rate}%
                    </span>
                  </td>
                  <td className="py-2">
                    <span className="inline-flex items-center gap-0.5">
                      <Star className="h-3 w-3 fill-warning text-warning" />
                      {row.rating}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
