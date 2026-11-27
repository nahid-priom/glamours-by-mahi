import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { courierRepository } from '../repositories/courier.repository'
import { FinancialAccountSelectField } from '@/components/payments/FinancialAccountSelectField'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { toastRpcError } from '@/lib/errors/rpc-error'
import { formatBDT } from '@/lib/format'
import { queryKeys } from '@/lib/query/keys'

export function CourierSettlementsPage() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [accountBySettlement, setAccountBySettlement] = useState<Record<string, string>>({})
  const [reverseTarget, setReverseTarget] = useState<string | null>(null)
  const [reverseReason, setReverseReason] = useState('')

  const { data = [], isLoading, error } = useQuery({
    queryKey: [...queryKeys.couriers, 'settlements'],
    queryFn: () => courierRepository.listSettlements(),
  })

  const { data: accounts = [] } = useQuery({
    queryKey: [...queryKeys.couriers, 'settlement-accounts'],
    queryFn: () => courierRepository.listFinancialAccounts(),
  })

  const settle = useMutation({
    mutationFn: ({ id, accountId }: { id: string; accountId: string }) =>
      courierRepository.markSettlementSettled(id, accountId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: [...queryKeys.couriers, 'settlements'] })
    },
    onError: (error: Error) => toastRpcError(toast, error),
  })

  const reverse = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      courierRepository.reverseSettlement(id, reason),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.couriers })
      await qc.invalidateQueries({ queryKey: queryKeys.accounts })
      setReverseTarget(null)
      setReverseReason('')
      toast('Settlement reversal recorded')
    },
    onError: (error: Error) => toastRpcError(toast, error),
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
              const accountId = accountBySettlement[row.id] ?? ''
              return (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="px-3 py-2">{company?.name || '—'}</td>
                  <td className="px-3 py-2">{parcel?.tracking_no || '—'}</td>
                  <td className="px-3 py-2">{formatBDT(Number(row.cod_amount))}</td>
                  <td className="px-3 py-2">{formatBDT(Number(row.courier_charge))}</td>
                  <td className="px-3 py-2">
                    {row.status === 'partially_settled' && row.settled_amount != null
                      ? `${formatBDT(Number(row.settled_amount))} / ${formatBDT(Number(row.settlement_amount))}`
                      : formatBDT(Number(row.settlement_amount))}
                  </td>
                  <td className="px-3 py-2">{row.status}</td>
                  <td className="px-3 py-2">
                    {row.status === 'pending' || row.status === 'partially_settled' ? (
                      <PermissionGate permission="courier.settle">
                        <div className="flex min-w-[16rem] items-end gap-2">
                          <FinancialAccountSelectField
                            label="Settle to"
                            className="min-w-0 flex-1 space-y-0.5"
                            value={accountId || null}
                            onChange={(id) =>
                              setAccountBySettlement((m) => ({
                                ...m,
                                [row.id]: id ?? '',
                              }))
                            }
                            accounts={accounts}
                            showBalance
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!accountId || settle.isPending}
                            onClick={() => settle.mutate({ id: row.id, accountId })}
                          >
                            Settle
                          </Button>
                        </div>
                      </PermissionGate>
                    ) : null}
                    {row.status === 'settled' || row.status === 'partially_settled' ? (
                      <PermissionGate permission={['courier.settle', 'transactions.void', 'accounts.manage']}>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={reverse.isPending}
                          onClick={() => {
                            setReverseTarget(row.id)
                            setReverseReason('')
                          }}
                        >
                          Reverse
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
      <Dialog open={Boolean(reverseTarget)} onOpenChange={(open) => {
        if (!open && !reverse.isPending) setReverseTarget(null)
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reverse courier settlement</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#6B7280]">The original posting remains in the audit history. Enter a reason for the accounting reversal.</p>
          <div className="space-y-1">
            <Label htmlFor="settlement-reverse-reason">Reason</Label>
            <Input
              id="settlement-reverse-reason"
              value={reverseReason}
              onChange={(event) => setReverseReason(event.target.value)}
              disabled={reverse.isPending}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={reverse.isPending} onClick={() => setReverseTarget(null)}>Cancel</Button>
            <Button
              variant="danger"
              disabled={!reverseTarget || !reverseReason.trim() || reverse.isPending}
              onClick={() => {
                if (reverseTarget && reverseReason.trim()) reverse.mutate({ id: reverseTarget, reason: reverseReason.trim() })
              }}
            >
              {reverse.isPending ? 'Reversing…' : 'Reverse settlement'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
