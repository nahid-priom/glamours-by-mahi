import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { courierRepository } from '../repositories/courier.repository'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { queryKeys } from '@/lib/query/keys'

type ItemDraft = Record<string, { received_qty: number; condition: string }>

export function ReturnRequestsPage() {
  const qc = useQueryClient()
  const [drafts, setDrafts] = useState<Record<string, ItemDraft>>({})
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({})

  const { data = [], isLoading, error } = useQuery({
    queryKey: [...queryKeys.couriers, 'returns'],
    queryFn: () => courierRepository.listReturnRequests('pending'),
  })

  const approve = useMutation({
    mutationFn: (requestId: string) => {
      const req = data.find((r) => r.id === requestId)
      const items =
        (req?.courier_return_items as unknown as Array<{
          id: string
          expected_qty: number
          condition: string | null
        }> | null) ?? []
      const draft = drafts[requestId] ?? {}
      return courierRepository.approveReturn(
        requestId,
        items.map((item) => ({
          id: item.id,
          received_qty: draft[item.id]?.received_qty ?? Number(item.expected_qty),
          condition: draft[item.id]?.condition || item.condition || 'sellable',
        })),
      )
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: [...queryKeys.couriers, 'returns'] })
    },
  })

  const reject = useMutation({
    mutationFn: (requestId: string) =>
      courierRepository.rejectReturn(requestId, rejectReason[requestId] || 'Rejected'),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: [...queryKeys.couriers, 'returns'] })
    },
  })

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#111827]">Courier Return Requests</h1>
        <p className="text-sm text-[#6B7280]">
          Approve with condition quantities or reject via RPC. Courier webhook returns create{' '}
          <strong>pending review</strong> requests — stock is not restocked until you approve here.
        </p>
      </div>

      {isLoading ? <p className="text-sm text-[#6B7280]">Loading…</p> : null}
      {error ? <p className="text-sm text-[#E11D48]">Could not load return requests.</p> : null}
      {!isLoading && data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white p-8 text-center text-sm text-[#6B7280]">
          No pending return requests.
        </div>
      ) : null}

      <ul className="space-y-3">
        {data.map((req) => {
          const company = req.courier_companies as unknown as { name: string } | null
          const parcel = req.courier_parcels as unknown as {
            tracking_no: string | null
            customer_name: string | null
          } | null
          const items =
            (req.courier_return_items as unknown as Array<{
              id: string
              expected_qty: number
              condition: string | null
            }> | null) ?? []

          return (
            <li key={req.id} className="rounded-xl border border-border bg-white p-4 space-y-3">
              <div>
                <p className="font-semibold">
                  {parcel?.tracking_no || req.id.slice(0, 8)} · {company?.name || 'Courier'}
                </p>
                <p className="text-xs text-[#9CA3AF]">
                  {parcel?.customer_name || '—'} · {req.courier_reason || 'No reason'} ·{' '}
                  {new Date(req.created_at).toLocaleString()}
                </p>
              </div>

              {items.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-[#6B7280]">Expected {item.expected_qty}</span>
                  <Input
                    type="number"
                    className="w-24"
                    placeholder="Received"
                    defaultValue={item.expected_qty}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [req.id]: {
                          ...(prev[req.id] ?? {}),
                          [item.id]: {
                            received_qty: Number(e.target.value) || 0,
                            condition: prev[req.id]?.[item.id]?.condition || item.condition || 'sellable',
                          },
                        },
                      }))
                    }
                  />
                  <select
                    className="h-9 rounded-md border border-border bg-white px-2 text-sm"
                    defaultValue={item.condition || 'sellable'}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [req.id]: {
                          ...(prev[req.id] ?? {}),
                          [item.id]: {
                            received_qty:
                              prev[req.id]?.[item.id]?.received_qty ?? Number(item.expected_qty),
                            condition: e.target.value,
                          },
                        },
                      }))
                    }
                  >
                    <option value="sellable">Sellable</option>
                    <option value="damaged">Damaged</option>
                    <option value="quarantine">Quarantine</option>
                    <option value="missing">Missing</option>
                    <option value="wrong_item">Wrong item</option>
                  </select>
                </div>
              ))}

              <div className="flex flex-wrap gap-2">
                <Input
                  placeholder="Reject reason"
                  className="max-w-xs"
                  value={rejectReason[req.id] ?? ''}
                  onChange={(e) =>
                    setRejectReason((prev) => ({ ...prev, [req.id]: e.target.value }))
                  }
                />
                <PermissionGate permission="sales.return.review">
                  <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(req.id)}>
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={reject.isPending}
                    onClick={() => reject.mutate(req.id)}
                  >
                    Reject
                  </Button>
                </PermissionGate>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
