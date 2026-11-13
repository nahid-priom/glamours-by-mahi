import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatBDT } from '@/lib/format'
import { ResponsiveDataView, MobileEntityCard } from '@/components/data-view'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getStaffCommissionSummary,
  listStaffCommissionEntries,
} from '../repositories/staff.repository'

function commissionStatusLabel(status: string, reversedAmount = 0) {
  if (status === 'reversed') return 'Reversed'
  if (reversedAmount > 0) return 'Partially reversed'
  return status
}

function eventTypeLabel(eventType: string | null | undefined) {
  switch (eventType) {
    case 'return_reverse':
      return 'Return'
    case 'exchange_reverse':
      return 'Exchange reverse'
    case 'exchange_replacement':
      return 'Exchange'
    case 'sale':
    default:
      return 'Sale'
  }
}

export function MyCommissionPage() {
  const [eventType, setEventType] = useState('all')

  const summary = useQuery({
    queryKey: ['staff-commission-summary'],
    queryFn: getStaffCommissionSummary,
  })
  const entries = useQuery({
    queryKey: ['staff-commission-entries', eventType],
    queryFn: () =>
      listStaffCommissionEntries({
        page: 1,
        page_size: 50,
        event_type: eventType === 'all' ? undefined : eventType,
      }),
  })

  const s = summary.data

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">My Commission</h1>
          <p className="text-sm text-[#6B7280]">
            Per-product commission for your sales, returns, and exchanges
          </p>
        </div>
        <label className="space-y-1 text-sm">
          <span className="text-[#6B7280]">Event</span>
          <Select value={eventType} onValueChange={setEventType}>
            <SelectTrigger className="h-9 min-w-[11rem]">
              <SelectValue placeholder="All events" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              <SelectItem value="sale">Sale</SelectItem>
              <SelectItem value="return_reverse">Return</SelectItem>
              <SelectItem value="exchange_reverse">Exchange reverse</SelectItem>
              <SelectItem value="exchange_replacement">Exchange</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </div>

      {s ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Today', value: s.today },
            { label: 'This Week', value: s.week },
            { label: 'This Month', value: s.month },
            {
              label: 'Accrued',
              value: Number(s.pending ?? 0) + Number(s.approved ?? 0),
            },
            { label: 'Pending', value: s.pending },
            { label: 'Approved', value: s.approved },
            { label: 'Paid', value: s.paid },
            { label: 'Reversed', value: s.reversed },
          ].map((c) => (
            <div key={c.label} className="rounded-xl border bg-white px-3 py-3">
              <p className="text-[11px] uppercase text-[#6B7280]">{c.label}</p>
              <p className="mt-1 text-lg font-semibold">{formatBDT(Number(c.value))}</p>
            </div>
          ))}
        </div>
      ) : null}

      {s?.last_paid_at ? (
        <p className="text-xs text-[#6B7280]">
          Last payment: {new Date(s.last_paid_at).toLocaleString()}
        </p>
      ) : null}

      <ResponsiveDataView
        items={entries.data?.items ?? []}
        getKey={(r) => r.id}
        isLoading={entries.isLoading}
        error={entries.error as Error | null}
        emptyTitle="Commission entry নেই"
        renderTable={(rows) => (
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-[#F9FAFB] text-left text-xs uppercase text-[#6B7280]">
                <tr>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Variant</th>
                  <th className="px-3 py-2">Qty</th>
                  <th className="px-3 py-2">Event</th>
                  <th className="px-3 py-2">Invoice</th>
                  <th className="px-3 py-2">Commission</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const reversed = Number(r.reversed_amount ?? 0)
                  return (
                    <tr key={r.id} className="border-t">
                      <td className="px-3 py-2 font-medium">{r.product_name ?? '—'}</td>
                      <td className="px-3 py-2">{r.variant_name ?? '—'}</td>
                      <td className="px-3 py-2 tabular-nums">{r.qty ?? '—'}</td>
                      <td className="px-3 py-2">{eventTypeLabel(r.event_type)}</td>
                      <td className="px-3 py-2">{r.invoice_no ?? '—'}</td>
                      <td className="px-3 py-2 font-semibold">
                        {formatBDT(Number(r.commission_amount))}
                        {reversed > 0 ? (
                          <span className="mt-0.5 block text-[11px] font-normal text-[#9CA3AF]">
                            −{formatBDT(reversed)} reverse
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 capitalize">
                        {commissionStatusLabel(r.status, reversed)}
                      </td>
                      <td className="px-3 py-2 text-xs text-[#6B7280]">
                        {new Date(r.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        renderCard={(r) => (
          <MobileEntityCard
            title={r.product_name ?? r.invoice_no ?? 'Commission'}
            subtitle={[r.variant_name, r.invoice_no].filter(Boolean).join(' · ') || undefined}
            badges={
              <span className="text-xs capitalize">
                {eventTypeLabel(r.event_type)} ·{' '}
                {commissionStatusLabel(r.status, Number(r.reversed_amount ?? 0))}
              </span>
            }
            rows={[
              { label: 'Commission', value: formatBDT(Number(r.commission_amount)) },
              ...(Number(r.reversed_amount ?? 0) > 0
                ? [
                    {
                      label: 'Reversed',
                      value: formatBDT(Number(r.reversed_amount)),
                    },
                  ]
                : []),
              { label: 'Qty', value: String(r.qty ?? '—') },
              { label: 'Date', value: new Date(r.created_at).toLocaleDateString() },
            ]}
          />
        )}
      />
    </div>
  )
}
