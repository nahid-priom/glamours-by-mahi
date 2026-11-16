import { formatBDT, formatNumber } from '@/lib/format'
import type { ProductCatalogKpis } from '../repositories/catalog.repository'

type Props = {
  kpis?: ProductCatalogKpis
  loading?: boolean
  showValue?: boolean
}

function Card({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'pink' | 'amber' | 'rose'
}) {
  const tones = {
    default: 'border-border bg-white',
    pink: 'border-[#FECDD3] bg-[#FFF1F2]',
    amber: 'border-amber-200 bg-amber-50',
    rose: 'border-rose-200 bg-rose-50',
  }
  return (
    <div className={`rounded-xl border px-3 py-3 shadow-sm ${tones[tone]}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-[#6B7280]">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-[#111111]">{value}</p>
    </div>
  )
}

export function ProductKpiCards({ kpis, loading, showValue }: Props) {
  if (loading && !kpis) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[68px] animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    )
  }

  const k = kpis ?? {
    totalProducts: 0,
    activeProducts: 0,
    draftProducts: 0,
    pendingProducts: 0,
    totalVariants: 0,
    lowStock: 0,
    outOfStock: 0,
    inventoryValue: null,
  }

  return (
    <div className="product-module grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <Card label="Total products" value={formatNumber(k.totalProducts)} tone="pink" />
      <Card label="Active" value={formatNumber(k.activeProducts)} />
      <Card label="Variants" value={formatNumber(k.totalVariants)} />
      <Card label="Low stock" value={formatNumber(k.lowStock)} tone="amber" />
      <Card label="Out of stock" value={formatNumber(k.outOfStock)} tone="rose" />
      {showValue ? (
        <Card
          label="Inventory value"
          value={k.inventoryValue != null ? formatBDT(k.inventoryValue) : '—'}
        />
      ) : (
        <Card label="Draft / Pending" value={`${k.draftProducts} / ${k.pendingProducts}`} />
      )}
    </div>
  )
}
