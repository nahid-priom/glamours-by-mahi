import { formatBDT } from '@/lib/format'
import { AppImage } from '@/components/common/AppImage'
import { DashboardSectionCard } from './DashboardSectionCard'

interface TopSellingProductsCardProps {
  products: {
    rank: number
    productId: string
    name: string
    qty: number
    revenue: number
    image: string
  }[]
}

export function TopSellingProductsCard({ products }: TopSellingProductsCardProps) {
  return (
    <DashboardSectionCard title="Top Selling Products" action={{ label: 'View all', to: '/reports/sales' }}>
      <ul className="space-y-3">
        {products.map((p) => (
          <li key={p.productId} className="flex items-center gap-3">
            <span className="w-4 text-xs font-semibold text-[#6B7280]">{p.rank}</span>
            <AppImage
              src={p.image}
              alt={p.name}
              className="h-10 w-10 shrink-0 rounded-lg"
              aspectRatio="square"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[#111111]">{p.name}</p>
              <p className="text-[11px] text-[#6B7280]">{p.qty} sold</p>
            </div>
            <p className="shrink-0 text-sm font-semibold">{formatBDT(p.revenue)}</p>
          </li>
        ))}
        {products.length === 0 && (
          <p className="text-sm text-[#6B7280]">No sales data yet.</p>
        )}
      </ul>
    </DashboardSectionCard>
  )
}
