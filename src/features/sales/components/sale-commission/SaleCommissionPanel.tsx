import { Loader2 } from 'lucide-react'
import { formatBDT } from '@/lib/format'
import { useSaleCommissions } from '../../hooks/use-sale-commissions'
import {
  buildCommissionTimeline,
  commissionStatusClass,
  commissionStatusLabel,
  contributorLabel,
} from './sale-commission-presentation'

export function SaleCommissionPanel({ saleId }: { saleId: string }) {
  const { data, isLoading, error } = useSaleCommissions(saleId)

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-white p-4 text-sm text-text-muted">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
        Loading commission audit…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-white p-4 text-sm text-danger">
        {error instanceof Error ? error.message : 'Could not load commission audit'}
      </div>
    )
  }

  if (!data || (data.summary.row_count === 0 && data.exceptions.length === 0)) {
    return (
      <div className="rounded-xl border border-border bg-white">
        <div className="border-b border-border px-4 py-2 text-sm font-semibold">Commission</div>
        <p className="p-4 text-sm text-text-muted">No commission accrued for this sale.</p>
      </div>
    )
  }

  const summaryCards = [
    { label: 'Accrued', value: data.summary.accrued },
    { label: 'Reversed', value: data.summary.reversed },
    { label: 'Net earned', value: data.summary.net_earned },
    { label: 'Outstanding', value: data.summary.outstanding },
    { label: 'Recoverable', value: data.summary.recoverable },
  ]
  const timeline = buildCommissionTimeline(data.commissions)

  return (
    <div className="rounded-xl border border-border bg-white">
      <div className="border-b border-border px-4 py-2 text-sm font-semibold">Commission audit</div>

      <div className="grid gap-2 border-b border-border p-3 sm:grid-cols-2 lg:grid-cols-5">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-lg bg-[#F9FAFB] px-3 py-2 text-sm">
            <p className="text-text-muted">{card.label}</p>
            <p className="font-medium text-text-primary">{formatBDT(card.value)}</p>
          </div>
        ))}
      </div>

      {data.exceptions.length > 0 ? (
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-medium text-amber-900">Attribution exceptions</p>
          <ul className="mt-2 space-y-1 text-sm text-text-muted">
            {data.exceptions.map((ex) => (
              <li key={ex.id}>
                {ex.reason}
                {ex.resolved_at ? ' · resolved' : ' · open'}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="border-b border-border">
        <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
          Contributors
        </div>
        {data.commissions.length === 0 ? (
          <p className="px-4 pb-3 text-sm text-text-muted">No commission rows.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.commissions.map((row) => {
              const reversed = Number(row.reversed_amount ?? 0)
              return (
                <li key={row.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium text-text-primary">{contributorLabel(row)}</p>
                    <p className="text-text-muted">
                      Base {formatBDT(Number(row.base_amount))}
                      {reversed > 0 ? ` · Reversed ${formatBDT(reversed)}` : ''}
                      {Number(row.recoverable_amount ?? 0) > 0
                        ? ` · Recoverable ${formatBDT(Number(row.recoverable_amount))}`
                        : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatBDT(Number(row.commission_amount))}</p>
                    <span
                      className={`mt-1 inline-block rounded px-1.5 py-0.5 text-xs ${commissionStatusClass(row.status, reversed)}`}
                    >
                      {commissionStatusLabel(row.status, reversed)}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div>
        <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
          Timeline
        </div>
        {timeline.length === 0 ? (
          <p className="px-4 pb-3 text-sm text-text-muted">No commission events.</p>
        ) : (
          <ul className="divide-y divide-border">
            {timeline.map((ev) => (
              <li key={ev.id} className="flex justify-between gap-2 px-4 py-2 text-sm">
                <span>{ev.label}</span>
                <span className="shrink-0 text-xs text-text-muted">
                  {new Date(ev.at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
