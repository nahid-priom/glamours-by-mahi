import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { courierRepository } from '../repositories/courier.repository'
import { queryKeys } from '@/lib/query/keys'

export function DeliveryTrackingPage() {
  const [parcelId, setParcelId] = useState('')
  const { data: parcels = [] } = useQuery({
    queryKey: [...queryKeys.couriers, 'parcels'],
    queryFn: () => courierRepository.listParcels(),
  })
  const { data: events = [], isLoading, error } = useQuery({
    queryKey: [...queryKeys.couriers, 'events', parcelId || 'all'],
    queryFn: () => courierRepository.listTrackingEvents(parcelId || null),
  })

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#111827]">Delivery Tracking</h1>
        <p className="text-sm text-[#6B7280]">Courier events and parcel status timeline.</p>
      </div>

      <select
        className="h-9 max-w-md rounded-md border border-border bg-white px-2 text-sm"
        value={parcelId}
        onChange={(e) => setParcelId(e.target.value)}
      >
        <option value="">All parcels</option>
        {parcels.map((p) => (
          <option key={p.id} value={p.id}>
            {p.tracking_no || p.id.slice(0, 8)} · {p.status}
          </option>
        ))}
      </select>

      {isLoading ? <p className="text-sm text-[#6B7280]">Loading…</p> : null}
      {error ? <p className="text-sm text-[#E11D48]">Could not load events.</p> : null}

      <ul className="space-y-2">
        {events.map((e) => {
          const parcel = e.courier_parcels as unknown as {
            tracking_no: string | null
            customer_name: string | null
          } | null
          return (
            <li key={e.id} className="rounded-xl border border-border bg-white px-4 py-3">
              <p className="text-sm font-semibold">{e.event_type}</p>
              <p className="text-xs text-[#9CA3AF]">
                {parcel?.tracking_no || '—'} · {parcel?.customer_name || '—'} ·{' '}
                {e.occurred_at ? new Date(e.occurred_at).toLocaleString() : '—'}
              </p>
            </li>
          )
        })}
      </ul>

      {!isLoading && events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white p-8 text-center text-sm text-[#6B7280]">
          No tracking events.
        </div>
      ) : null}
    </div>
  )
}
