import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { commissionsRepository } from '../repositories/commissions.repository'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { Button } from '@/components/ui/button'
import { formatBDT } from '@/lib/format'

export function SalesCommissionsPage() {
  const qc = useQueryClient()
  const [payAccountId, setPayAccountId] = useState<string>('')

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['sales-commissions'],
    queryFn: () => commissionsRepository.listCommissions(),
  })

  const { data: accounts = [] } = useQuery({
    queryKey: ['commission-accounts'],
    queryFn: () => commissionsRepository.listFinancialAccounts(),
  })

  const approve = useMutation({
    mutationFn: commissionsRepository.approveCommission,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['sales-commissions'] }),
  })

  const pay = useMutation({
    mutationFn: ({ id, accountId }: { id: string; accountId: string }) =>
      commissionsRepository.payCommission(id, accountId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['sales-commissions'] }),
  })

  const defaultAccount = payAccountId || accounts[0]?.id || ''

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#111827]">Sales Commissions</h1>
        <p className="text-sm text-[#6B7280]">Accrued on POS sales, approved and paid via RPC.</p>
      </div>

      {accounts.length > 0 ? (
        <label className="flex items-center gap-2 text-sm">
          Payment account
          <select
            className="h-8 rounded border border-border px-2"
            value={defaultAccount}
            onChange={(e) => setPayAccountId(e.target.value)}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {isLoading ? <p className="text-sm text-[#6B7280]">Loading…</p> : null}
      {error ? <p className="text-sm text-[#E11D48]">Could not load commissions.</p> : null}

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
            <tr>
              <th className="px-3 py-2 text-left">Salesperson</th>
              <th className="px-3 py-2 text-left">Invoice</th>
              <th className="px-3 py-2 text-left">Base</th>
              <th className="px-3 py-2 text-left">Commission</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left" />
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                <td className="px-3 py-2">{row.profiles?.full_name ?? '—'}</td>
                <td className="px-3 py-2">{row.sales?.invoice_no ?? '—'}</td>
                <td className="px-3 py-2">{formatBDT(Number(row.base_amount))}</td>
                <td className="px-3 py-2">{formatBDT(Number(row.commission_amount))}</td>
                <td className="px-3 py-2">{row.status}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    {row.status === 'pending' ? (
                      <PermissionGate permission="sales.commission.approve">
                        <Button size="sm" variant="outline" onClick={() => approve.mutate(row.id)}>
                          Approve
                        </Button>
                      </PermissionGate>
                    ) : null}
                    {row.status === 'approved' ? (
                      <PermissionGate permission="sales.commission.pay">
                        <Button
                          size="sm"
                          disabled={!defaultAccount}
                          onClick={() => pay.mutate({ id: row.id, accountId: defaultAccount })}
                        >
                          Pay
                        </Button>
                      </PermissionGate>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && data.length === 0 ? (
          <p className="p-6 text-center text-sm text-[#6B7280]">No commissions yet.</p>
        ) : null}
      </div>
    </div>
  )
}
