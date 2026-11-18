import { Loader2 } from 'lucide-react'
import { formatBDT, formatNumber } from '@/lib/format'
import type { SupplierDirectorySummary } from '../repositories/suppliers.repository'

type Props = {
  summary: SupplierDirectorySummary | undefined
  isLoading?: boolean
}

function KpiCard({
  label,
  value,
  danger,
  sub,
}: {
  label: string
  value: string
  danger?: boolean
  sub?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold tabular-nums ${danger ? 'text-[#E11D48]' : 'text-foreground'}`}
      >
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  )
}

export function SupplierDirectoryKPIs({ summary, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading summary…
      </div>
    )
  }

  const unit = summary?.stock_unit_label ?? 'pcs'

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <KpiCard label="Total suppliers" value={formatNumber(summary?.total_suppliers ?? 0)} />
      <KpiCard label="Total purchases" value={formatBDT(summary?.total_purchases ?? 0)} />
      <KpiCard label="Total payments" value={formatBDT(summary?.total_payments ?? 0)} />
      <KpiCard label="Current due" value={formatBDT(summary?.current_due ?? 0)} danger />
      <KpiCard
        label="Total items in stock"
        value={formatNumber(summary?.total_items_in_stock ?? 0)}
        sub={unit}
      />
    </div>
  )
}