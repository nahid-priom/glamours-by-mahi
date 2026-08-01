import { useQuery } from '@tanstack/react-query'
import { formatBDT } from '@/lib/format'
import { ResponsiveDataView, MobileEntityCard } from '@/components/data-view'
import {
  getStaffCommissionSummary,
  listStaffCommissionEntries,
} from '../repositories/staff.repository'

function commissionStatusLabel(status: string, reversedAmount = 0) {
  if (status === 'reversed') return 'Reversed'
  if (reversedAmount > 0) return 'Partially reversed'
  return status
}

export function MyCommissionPage() {
  const summary = useQuery({
    queryKey: ['staff-commission-summary'],
    queryFn: getStaffCommissionSummary,
  })
  const entries = useQuery({
    queryKey: ['staff-commission-entries'],
    queryFn: () => listStaffCommissionEntries({ page: 1, page_size: 30 }),
  })

  const s = summary.data

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-xl font-bold">My Commission</h1>
        <p className="text-sm text-[#6B7280]">শুধু আপনার Commission — পরিবর্তন করা যাবে না</p>
      </div>

      {s ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Today', value: s.today },
            { label: 'This Week', value: s.week },
            { label: 'This Month', value: s.month },
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
                  <th className="px-3 py-2">Invoice</th>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Sale</th>
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
                      <td className="px-3 py-2 font-medium">{r.invoice_no ?? '—'}</td>
                      <td className="px-3 py-2">{r.customer_name ?? '—'}</td>
                      <td className="px-3 py-2">{formatBDT(Number(r.grand_total ?? 0))}</td>
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
            title={r.invoice_no ?? 'Commission'}
            subtitle={r.customer_name ?? undefined}
            badges={
              <span className="text-xs capitalize">
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
              { label: 'Sale', value: formatBDT(Number(r.grand_total ?? 0)) },
              { label: 'Date', value: new Date(r.created_at).toLocaleDateString() },
            ]}
          />
        )}
      />
    </div>
  )
}
