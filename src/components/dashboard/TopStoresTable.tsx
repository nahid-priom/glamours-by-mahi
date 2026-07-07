import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatBDT } from '@/lib/format'
import type { TopStoreRow } from '@/types'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface TopStoresTableProps {
  data: TopStoreRow[]
}

export function TopStoresTable({ data }: TopStoresTableProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle>Top Stores</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-text-muted">
                    <th className="pb-2 font-medium">Store</th>
                    <th className="pb-2 font-medium">Orders</th>
                    <th className="pb-2 font-medium">Collection</th>
                    <th className="pb-2 font-medium">Growth</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => (
                    <tr key={row.store} className="border-b border-border/50">
                      <td className="py-2.5 font-medium">{row.store}</td>
                  <td className="py-2">{row.orders.toLocaleString('en-BD')}</td>
                  <td className="py-2">{formatBDT(row.collection)}</td>
                  <td className="py-2">
                    <span className={`inline-flex items-center gap-0.5 ${row.growth >= 0 ? 'text-success' : 'text-danger'}`}>
                      {row.growth >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {Math.abs(row.growth)}%
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
