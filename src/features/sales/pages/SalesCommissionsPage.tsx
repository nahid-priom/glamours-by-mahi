import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commissionsRepository } from '../repositories/commissions.repository'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { formatBDT } from '@/lib/format'
import { queryKeys } from '@/lib/query/keys'
import { cn } from '@/lib/utils'

function employeeName(row: Awaited<ReturnType<typeof commissionsRepository.listCommissions>>[number]) {
  if (row.employees?.full_name) {
    const code = row.employees.employee_code ? ` (${row.employees.employee_code})` : ''
    return `${row.employees.full_name}${code}`
  }
  if (row.profiles?.full_name) return row.profiles.full_name
  if (row.needs_employee_link) return 'Needs employee link'
  return '—'
}

export function SalesCommissionsPage() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [payAccountId, setPayAccountId] = useState<string>('')

  const { data = [], isLoading, error } = useQuery({
    queryKey: queryKeys.salesCommissions({}),
    queryFn: () => commissionsRepository.listCommissions(),
  })

  const { data: accounts = [] } = useQuery({
    queryKey: queryKeys.commissionAccounts,
    queryFn: () => commissionsRepository.listFinancialAccounts(),
  })

  const kpis = useMemo(() => {
    const sum = (status: string) =>
      data.filter((r) => r.status === status).reduce((s, r) => s + Number(r.commission_amount), 0)
    return {
      pending: sum('pending'),
      approved: sum('approved'),
      paid: sum('paid'),
      reversed: sum('reversed'),
      month: data
        .filter((r) => r.created_at.slice(0, 7) === new Date().toISOString().slice(0, 7))
        .reduce((s, r) => s + Number(r.commission_amount), 0),
    }
  }, [data])

  const approve = useMutation({
    mutationFn: commissionsRepository.approveCommission,
    onSuccess: () => {
      toast('Commission approved')
      void qc.invalidateQueries({ queryKey: ['sales-commissions'] })
    },
    onError: (e) => toast(e instanceof Error ? e.message : 'Could not approve', 'error'),
  })

  const pay = useMutation({
    mutationFn: ({ id, accountId }: { id: string; accountId: string }) =>
      commissionsRepository.payCommission(id, accountId),
    onSuccess: () => {
      toast('Commission paid')
      void qc.invalidateQueries({ queryKey: ['sales-commissions'] })
    },
    onError: (e) => toast(e instanceof Error ? e.message : 'Could not pay', 'error'),
  })

  const defaultAccount = payAccountId || accounts[0]?.id || ''

  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#111827]">Commissions</h1>
        <p className="text-sm text-[#6B7280]">
          Employee commissions from POS sales — approve, pay directly, or include in payroll.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Pending', value: kpis.pending },
          { label: 'Approved', value: kpis.approved },
          { label: 'Paid', value: kpis.paid },
          { label: 'Reversed', value: kpis.reversed },
          { label: 'This month', value: kpis.month },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-[#6B7280]">{kpi.label}</p>
            <p className="text-lg font-bold tabular-nums">{formatBDT(kpi.value)}</p>
          </div>
        ))}
      </div>

      {accounts.length > 0 ? (
        <label className="flex flex-wrap items-center gap-2 text-sm">
          Payment account
          <select
            className="h-9 min-w-[12rem] rounded-md border border-border px-2"
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

      <div className="hidden overflow-x-auto rounded-xl border border-border bg-white md:block">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
            <tr>
              <th className="px-3 py-2 text-left">Employee</th>
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
                <td className="px-3 py-2">{employeeName(row)}</td>
                <td className="px-3 py-2">{row.sales?.invoice_no ?? '—'}</td>
                <td className="px-3 py-2 tabular-nums">{formatBDT(Number(row.base_amount))}</td>
                <td className="px-3 py-2 tabular-nums">{formatBDT(Number(row.commission_amount))}</td>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      row.status === 'pending' && 'bg-amber-100 text-amber-900',
                      row.status === 'approved' && 'bg-blue-100 text-blue-900',
                      row.status === 'paid' && 'bg-emerald-100 text-emerald-900',
                      row.status === 'reversed' && 'bg-rose-100 text-rose-900',
                    )}
                  >
                    {row.status}
                  </span>
                </td>
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
      </div>

      <div className="space-y-2 md:hidden">
        {data.map((row) => (
          <div key={row.id} className="rounded-xl border border-border bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold">{employeeName(row)}</p>
                <p className="text-xs text-[#6B7280]">{row.sales?.invoice_no ?? '—'}</p>
              </div>
              <p className="shrink-0 text-sm font-bold tabular-nums">
                {formatBDT(Number(row.commission_amount))}
              </p>
            </div>
            <p className="mt-2 text-xs text-[#6B7280]">Status: {row.status}</p>
            <div className="mt-3 flex gap-2">
              {row.status === 'pending' ? (
                <PermissionGate permission="sales.commission.approve">
                  <Button className="min-h-11 flex-1" variant="outline" onClick={() => approve.mutate(row.id)}>
                    Approve
                  </Button>
                </PermissionGate>
              ) : null}
              {row.status === 'approved' ? (
                <PermissionGate permission="sales.commission.pay">
                  <Button
                    className="min-h-11 flex-1"
                    disabled={!defaultAccount}
                    onClick={() => pay.mutate({ id: row.id, accountId: defaultAccount })}
                  >
                    Pay
                  </Button>
                </PermissionGate>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {!isLoading && data.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-[#6B7280]">
          No commissions yet. Complete a POS sale with an employee who has an active rule.
        </p>
      ) : null}
    </div>
  )
}
