import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-session'
import { supabase } from '@/lib/supabase/client'
import { toQueryBounds } from '@/lib/datetime/bd'
import { formatBDT } from '@/lib/format'
import { ReportShell, useReportRange } from '../components/ReportShell'
import { ReportKPIGrid } from '../components/ReportKPIGrid'
import { reportsRepository } from '../repositories/reports.repository'
import { reportQueryKey } from '../reports.filters'

type UntypedRpc = (
  fn: string,
  args?: object,
) => Promise<{ data: unknown; error: { message: string } | null }>
const untypedRpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc

type CourierReport = {
  summary: {
    total_parcels: number
    booked: number
    in_transit: number
    delivered: number
    returned: number
    cancelled: number
    cod_collected: number
  }
  by_company: Array<{
    courier_company_id: string
    name: string
    parcels: number
    delivered: number
    returned: number
  }>
  recent_syncs: Array<{
    id: string
    provider_id: string
    action: string
    success: boolean
    error_message: string | null
    created_at: string
  }>
}

async function fetchCourierReport(from: string, to: string): Promise<CourierReport> {
  const bounds = toQueryBounds(from, to)
  const { data, error } = await untypedRpc('get_courier_report', {
    payload: { from: bounds.fromIso, to: bounds.toIso },
  })
  if (error) throw error
  return data as CourierReport
}

export function CourierReportPage() {
  const { can } = useAuth()
  const canCourier = can('courier.read')
  const { range, setRange, filters, applyPreset, clearFilters, activeCount } = useReportRange()

  const { data, isLoading, error } = useQuery({
    queryKey: reportQueryKey('courier', range),
    enabled: canCourier,
    queryFn: () => fetchCourierReport(range.from, range.to),
  })

  const summary = data?.summary
  const successRate =
    summary && summary.total_parcels > 0
      ? Math.round((summary.delivered / summary.total_parcels) * 1000) / 10
      : 0

  if (!canCourier) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        Courier performance requires <code>courier.read</code>. Reports access alone is not
        enough for this RPC.
      </div>
    )
  }

  return (
    <ReportShell
      title="Courier Performance"
      subtitle="Parcel volumes and delivery outcomes from get_courier_report. COD collected on delivered parcels is not the same as settled COD."
      range={range}
      onRangeChange={setRange}
      onApplyPreset={applyPreset}
      onClearFilters={clearFilters}
      activeFilterCount={activeCount}
      filtersForMobile={filters}
      onExport={() =>
        reportsRepository.exportReportCsv(
          `courier-${range.from}-${range.to}.csv`,
          ['Courier', 'Parcels', 'Delivered', 'Returned'],
          (data?.by_company ?? []).map((row) => [
            row.name,
            row.parcels,
            row.delivered,
            row.returned,
          ]),
        )
      }
    >
      {isLoading ? <p className="text-sm text-[#6B7280]">Loading…</p> : null}
      {error ? (
        <p className="text-sm text-[#E11D48]">
          Failed to load courier report. Check courier.read and RPC availability.
        </p>
      ) : null}

      {summary ? (
        <ReportKPIGrid
          items={[
            { id: 'parcels', label: 'Total shipments', value: String(summary.total_parcels) },
            { id: 'delivered', label: 'Delivered', value: String(summary.delivered) },
            { id: 'transit', label: 'In transit', value: String(summary.in_transit) },
            { id: 'returned', label: 'Returned', value: String(summary.returned) },
            {
              id: 'rate',
              label: 'Delivery success rate',
              value: `${successRate}%`,
            },
            {
              id: 'cod',
              label: 'COD collected (delivered)',
              value: formatBDT(summary.cod_collected),
              hint: '≠ settled — see COD Settlement',
            },
          ]}
        />
      ) : null}

      {data?.by_company?.length ? (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
              <tr>
                <th className="px-3 py-2 text-left">Courier</th>
                <th className="px-3 py-2 text-right">Parcels</th>
                <th className="px-3 py-2 text-right">Delivered</th>
                <th className="px-3 py-2 text-right">Returned</th>
              </tr>
            </thead>
            <tbody>
              {data.by_company.map((row) => (
                <tr key={row.courier_company_id} className="border-b last:border-0">
                  <td className="px-3 py-2">{row.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.parcels}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.delivered}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.returned}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {data?.recent_syncs?.length ? (
        <section className="rounded-xl border bg-white p-4">
          <h2 className="text-sm font-semibold">Recent API syncs</h2>
          <ul className="mt-2 space-y-1 text-xs text-[#6B7280]">
            {data.recent_syncs.map((s) => (
              <li key={s.id}>
                {new Date(s.created_at).toLocaleString()} · {s.provider_id} · {s.action} ·{' '}
                {s.success ? 'OK' : s.error_message || 'Failed'}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </ReportShell>
  )
}
