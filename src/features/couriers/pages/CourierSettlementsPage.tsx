import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { courierRepository } from '../repositories/courier.repository'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { Button } from '@/components/ui/button'
import { formatBDT } from '@/lib/format'
import { queryKeys } from '@/lib/query/keys'

export function CourierSettlementsPage() {
  const qc = useQueryClient()
  const { data = [], isLoading, error } = useQuery({
    queryKey: [...queryKeys.couriers, 'settlements'],
    queryFn: () => courierRepository.listSettlements(),
  })

  const settle = useMutation({
    mutationFn: (id: string) => courierRepository.markSettlementSettled(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: [...queryKeys.couriers, 'settlements'] })
    },
  })

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#111827]">Courier Settlements</h1>
        <p className="text-sm text-[#6B7280]">COD and charge settlements with courier partners.</p>
      </div>

      {isLoading ? <p className="text-sm text-[#6B7280]">Loading…</p> : null}
      {error ? <p className="text-sm text-[#E11D48]">Could not load settlements.</p> : null}
      {!isLoading && data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white p-8 text-center text-sm text-[#6B7280]">
          No settlements yet.
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
            <tr>
              <th className="px-3 py-2 text-left">Courier</th>
              <th className="px-3 py-2 text-left">Tracking</th>
              <th className="px-3 py-2 text-left">COD</th>
              <th className="px-3 py-2 text-left">Charge</th>
              <th className="px-3 py-2 text-left">Settlement</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left" />
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const company = row.courier_companies as unknown as { name: string } | null
              const parcel = row.courier_parcels as unknown as { tracking_no: string | null } | null
              return (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="px-3 py-2">{company?.name || '—'}</td>
                  <td className="px-3 py-2">{parcel?.tracking_no || '—'}</td>
                  <td className="px-3 py-2">{formatBDT(Number(row.cod_amount))}</td>
                  <td className="px-3 py-2">{formatBDT(Number(row.courier_charge))}</td>
                  <td className="px-3 py-2">{formatBDT(Number(row.settlement_amount))}</td>
                  <td className="px-3 py-2">{row.status}</td>
                  <td className="px-3 py-2">
                    {row.status === 'pending' ? (
                      <PermissionGate permission="courier.manage">
                        <Button size="sm" variant="outline" onClick={() => settle.mutate(row.id)}>
                          Mark settled
                        </Button>
                      </PermissionGate>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
