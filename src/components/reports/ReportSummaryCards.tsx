import { formatBDT } from '@/lib/format'

export type ReportSummaryCard = {
  label: string
  value: number | string
  format?: 'currency' | 'number' | 'text'
}

export function ReportSummaryCards({ cards }: { cards: ReportSummaryCard[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-border bg-white px-3 py-3">
          <p className="text-[11px] uppercase tracking-wide text-[#6B7280]">{card.label}</p>
          <p className="mt-1 text-sm font-semibold text-[#111827]">
            {card.format === 'currency' && typeof card.value === 'number'
              ? formatBDT(card.value)
              : card.value}
          </p>
        </div>
      ))}
    </div>
  )
}
