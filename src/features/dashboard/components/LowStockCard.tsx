import { AppImage } from '@/components/common/AppImage'
import { DashboardSectionCard } from './DashboardSectionCard'

interface LowStockCardProps {
  products: {
    productId: string
    productName: string
    branchName: string
    qty: number
    image: string
  }[]
}

export function LowStockCard({ products }: LowStockCardProps) {
  return (
    <DashboardSectionCard title="Low Stock Alert" action={{ label: 'View all', to: '/inventory/low-stock' }}>
      <ul className="space-y-3">
        {products.map((p) => (
          <li key={p.productId} className="flex items-center gap-3">
            <AppImage
              src={p.image}
              alt={p.productName}
              className="h-10 w-10 shrink-0 rounded-lg"
              aspectRatio="square"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[#111111]">{p.productName}</p>
              <p className="text-[11px] text-[#6B7280]">{p.branchName}</p>
            </div>
            <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-[#E11D48]">
              {p.qty} left
            </span>
          </li>
        ))}
        {products.length === 0 && (
          <p className="text-sm text-[#6B7280]">All stock levels look healthy.</p>
        )}
      </ul>
    </DashboardSectionCard>
  )
}
