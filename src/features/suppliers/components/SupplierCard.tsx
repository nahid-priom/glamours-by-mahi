import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatBDT } from '@/lib/format'
import type { SupplierDirectoryCard } from '../repositories/suppliers.repository'
import { formatActivityDate, stockQuantityLabel, supplierInitials } from '../utils/supplier-display'

type Props = {
  supplier: SupplierDirectoryCard
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium tabular-nums text-foreground">{value}</p>
    </div>
  )
}

export function SupplierCard({ supplier }: Props) {
  const locationHint = [supplier.phone, supplier.address].filter(Boolean).join(' · ') || '—'
  const due = Number(supplier.current_due)
  const stockLabel = stockQuantityLabel(supplier.stock_on_hand)
  const soldLabel =
    supplier.units_sold == null ? '—' : supplier.units_sold.toLocaleString('en-BD')

  return (
    <article className="flex h-full flex-col rounded-xl border border-border bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF] text-sm font-semibold text-[#2563EB]"
          aria-hidden
        >
          {supplierInitials(supplier.name)}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-foreground">{supplier.name}</h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{locationHint}</p>
        </div>
        <Badge variant={supplier.status === 'active' ? 'success' : 'default'}>{supplier.status}</Badge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 sm:grid-cols-3">
        <Metric label="Current due" value={due > 0 ? formatBDT(due) : '—'} />
        <Metric label="Paid total" value={formatBDT(supplier.total_paid)} />
        <Metric label="In stock" value={stockLabel} />
        <Metric label="Units sold" value={soldLabel} />
        <Metric label="Last activity" value={formatActivityDate(supplier.last_activity_at)} />
      </div>

      <Link
        to={`/suppliers/${supplier.id}?tab=ledger`}
        className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[#2563EB] hover:underline"
      >
        View supplier
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </article>
  )
}