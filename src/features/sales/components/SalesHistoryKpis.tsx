import { useState } from 'react'
import {
  ChevronDown,
  FileText,
  HandCoins,
  ReceiptText,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { formatBDT } from '@/lib/format'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { SalesHistoryKpis as Kpis } from '../types/sale.types'

type MainCard = {
  key: keyof Kpis
  label: string
  icon: LucideIcon
  money?: boolean
  tone: string
}

const MAIN_CARDS: MainCard[] = [
  { key: 'total_sales', label: 'Total Sales', icon: ReceiptText, money: true, tone: 'text-primary' },
  { key: 'total_paid', label: 'Amount Received', icon: HandCoins, money: true, tone: 'text-success' },
  { key: 'total_due', label: 'Total Due', icon: Wallet, money: true, tone: 'text-danger' },
  { key: 'total_invoices', label: 'Total Invoices', icon: FileText, tone: 'text-text-primary' },
]

const MORE_METRICS: Array<{ key: keyof Kpis; label: string; money?: boolean }> = [
  { key: 'total_discount', label: 'Discount', money: true },
  { key: 'returned_voided', label: 'Returned / Voided' },
  { key: 'average_invoice', label: 'Average Invoice', money: true },
  { key: 'total_items_sold', label: 'Items Sold' },
]

function displayValue(value: number, money?: boolean): string {
  return money ? formatBDT(Number(value)) : Number(value).toLocaleString('en-US')
}

export function SalesHistoryKpis({
  data,
  loading,
}: {
  data?: Kpis
  loading?: boolean
}) {
  const [showMore, setShowMore] = useState(false)

  if (loading && !data) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {MAIN_CARDS.map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.key}
              className="rounded-2xl border border-border bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-text-muted">{card.label}</p>
                <span className={cn('rounded-lg bg-surface-soft p-1.5', card.tone)}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className={cn('mt-2 text-xl font-bold tabular-nums', card.tone)}>
                {displayValue(data?.[card.key] ?? 0, card.money)}
              </p>
            </div>
          )
        })}
      </div>

      <div className="rounded-2xl border border-border bg-white">
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium text-text-primary"
          aria-expanded={showMore}
        >
          More Metrics
          <ChevronDown
            className={cn('h-4 w-4 text-text-muted transition-transform', showMore && 'rotate-180')}
          />
        </button>
        {showMore ? (
          <div className="grid grid-cols-2 gap-3 border-t border-border p-4 lg:grid-cols-4">
            {MORE_METRICS.map((m) => (
              <div key={m.key}>
                <p className="text-xs text-text-muted">{m.label}</p>
                <p className="mt-1 text-base font-semibold tabular-nums text-text-primary">
                  {displayValue(data?.[m.key] ?? 0, m.money)}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
