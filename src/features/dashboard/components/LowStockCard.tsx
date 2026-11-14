import { Package } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AppImage } from '@/components/common/AppImage'
import { DashboardSectionCard } from './DashboardSectionCard'

interface LowStockCardProps {
  products: {
    productId: string
    productName: string
    branchName: string
    qty: number
    image: string
    sku?: string
  }[]
  /** Compact mobile preview rows */
  compact?: boolean
}

export function LowStockCard({ products, compact = false }: LowStockCardProps) {
  if (compact) {
    return (
      <Link
        to="/inventory/low-stock"
        className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
      >
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
          <Package className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">Low Stock</p>
          <p className="text-xs text-slate-500">
            {products.length ? `${products.length} item(s) below threshold` : 'All levels healthy'}
          </p>
        </div>
        <span className="text-xs font-semibold text-[#E11D48]">View All ›</span>
      </Link>
    )
  }

  return (
    <DashboardSectionCard title="Low Stock Items" action={{ label: 'View All', to: '/inventory/low-stock' }}>
      <ul className="space-y-3">
        {products.map((p) => (
          <li key={p.productId} className="flex items-center gap-3">
            <AppImage
              src={p.image || undefined}
              alt={p.productName}
              className="h-11 w-11 shrink-0 rounded-lg bg-slate-100"
              aspectRatio="square"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[#111111]">{p.productName}</p>
              <p className="truncate text-[11px] text-[#6B7280]">
                {p.sku ? `SKU ${p.sku} · ` : ''}
                {p.branchName}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-[#E11D48]">
              Qty: {p.qty}
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
