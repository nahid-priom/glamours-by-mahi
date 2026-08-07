import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import {
  ReportFilterBar,
  ReportHeader,
  ReportPage,
  ReportSummaryCards,
  type ReportDateRange,
} from '@/components/reports'
import { toQueryBounds } from '@/lib/datetime/bd'
import { reportsRepository } from '../repositories/reports.repository'

type UntypedRpc = (fn: string, args?: object) => Promise<{ data: unknown; error: { message: string } | null }>
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

async function fetchCourierReport(range: ReportDateRange): Promise<CourierReport> {
  const bounds = toQueryBounds(range.from, range.to)
  const { data, error } = await untypedRpc('get_courier_report', {
    payload: { from: bounds.fromIso, to: bounds.toIso },
  })
  if (error) throw error
  return data as CourierReport
}

export function CourierReportPage() {
  const [range, setRange] = useState<ReportDateRange>(() => {
    const r = reportsRepository.defaultRange()
    return { from: r.from, to: r.to }
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['report-courier', range],
    queryFn: () => fetchCourierReport(range),
  })

  const summary = data?.summary

  return (
    <ReportPage>
      <ReportHeader
        title="Courier report"
        subtitle="Parcel volumes, delivery outcomes, and API sync activity"
      />
      <ReportFilterBar range={range} onRangeChange={setRange} />

      {isLoading ? <p className="text-sm text-[#6B7280]">Loading…</p> : null}
      {error ? <p className="text-sm text-[#E11D48]">Failed to load courier report.</p> : null}

      {summary ? (
        <ReportSummaryCards
          cards={[
            { label: 'Parcels', value: summary.total_parcels, format: 'number' },
            { label: 'Delivered', value: summary.delivered, format: 'number' },
            { label: 'In transit', value: summary.in_transit, format: 'number' },
            { label: 'Returned', value: summary.returned, format: 'number' },
            { label: 'COD collected', value: summary.cod_collected, format: 'currency' },
          ]}
        />
      ) : null}

      {data?.by_company?.length ? (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
              <tr>
                <th className="px-3 py-2 text-left">Courier</th>
                <th className="px-3 py-2 text-left">Parcels</th>
                <th className="px-3 py-2 text-left">Delivered</th>
                <th className="px-3 py-2 text-left">Returned</th>
              </tr>
            </thead>
            <tbody>
              {data.by_company.map((row) => (
                <tr key={row.courier_company_id} className="border-b last:border-0">
                  <td className="px-3 py-2">{row.name}</td>
                  <td className="px-3 py-2">{row.parcels}</td>
                  <td className="px-3 py-2">{row.delivered}</td>
                  <td className="px-3 py-2">{row.returned}</td>
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
    </ReportPage>
  )
}
