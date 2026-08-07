import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commissionsRepository } from '../repositories/commissions.repository'
import { listEmployees } from '@/features/hr/repositories/employees.repository'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

function isPayable(status: string) {
  return status === 'approved' || status === 'pending'
}

function statusLabel(status: string, reversedAmount = 0) {
  if (status === 'reversed') return 'reversed'
  if (reversedAmount > 0 && (status === 'pending' || status === 'approved' || status === 'paid')) {
    return 'partially reversed'
  }
  if (status === 'pending' || status === 'approved') return 'unpaid'
  return status
}

function commissionStatusClass(status: string, reversedAmount = 0) {
  if (status === 'reversed') return 'bg-rose-100 text-rose-900'
  if (reversedAmount > 0) return 'bg-amber-100 text-amber-900'
  if (status === 'pending' || status === 'approved') return 'bg-blue-100 text-blue-900'
  if (status === 'paid') return 'bg-emerald-100 text-emerald-900'
  return 'bg-[#F3F4F6] text-[#374151]'
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

export function SalesCommissionsPage() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [payAccountId, setPayAccountId] = useState<string>('')
  const [employeeId, setEmployeeId] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const filters = {
    employeeId: employeeId === 'all' ? null : employeeId,
    status: statusFilter === 'all' ? null : statusFilter,
  }

  const { data = [], isLoading, error } = useQuery({
    queryKey: queryKeys.salesCommissions(filters),
    queryFn: () => commissionsRepository.listCommissions(filters),
  })

  const { data: employeesData } = useQuery({
    queryKey: queryKeys.employees({ status: 'active', pageSize: 200 }),
    queryFn: () => listEmployees({ status: 'active', pageSize: 200 }),
  })

  const { data: accounts = [] } = useQuery({
    queryKey: queryKeys.commissionAccounts,
    queryFn: () => commissionsRepository.listFinancialAccounts(),
  })

  const employees = employeesData?.items ?? []

  const kpis = useMemo(() => {
    const sum = (statuses: string[]) =>
      data
        .filter((r) => statuses.includes(r.status))
        .reduce((s, r) => s + Number(r.commission_amount), 0)
    return {
      unpaid: sum(['approved', 'pending']),
      paid: sum(['paid']),
      reversed: data.reduce((s, r) => s + Number(r.reversed_amount ?? 0), 0),
      month: data
        .filter((r) => r.created_at.slice(0, 7) === new Date().toISOString().slice(0, 7))
        .reduce((s, r) => s + Number(r.commission_amount), 0),
    }
  }, [data])

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
          Employee commissions from POS sales — auto-assigned from commission rules, pay directly or
          include in payroll.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Unpaid', value: kpis.unpaid },
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

      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span className="text-[#6B7280]">Employee</span>
          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger className="h-9 min-w-[12rem]">
              <SelectValue placeholder="All employees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All employees</SelectItem>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.full_name} ({e.employee_code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-[#6B7280]">Status</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 min-w-[10rem]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="reversed">Reversed</SelectItem>
            </SelectContent>
          </Select>
        </label>

        {accounts.length > 0 ? (
          <label className="space-y-1 text-sm">
            <span className="text-[#6B7280]">Payment account</span>
            <select
              className="flex h-9 min-w-[12rem] rounded-md border border-border px-2"
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
      </div>

      {isLoading ? <p className="text-sm text-[#6B7280]">Loading…</p> : null}
      {error ? (
        <p className="text-sm text-[#E11D48]">
          {error instanceof Error ? error.message : 'Could not load commissions.'}
        </p>
      ) : null}

      <div className="hidden overflow-x-auto rounded-xl border border-border bg-white md:block">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="border-b bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
            <tr>
              <th className="px-3 py-2 text-left">Employee</th>
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-left">Event</th>
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
                <td className="px-3 py-2">
                  <p className="font-medium">{row.product_name ?? '—'}</p>
                  {row.variant_name ? (
                    <p className="text-[11px] text-[#9CA3AF]">
                      {row.variant_name}
                      {row.qty != null ? ` · qty ${row.qty}` : ''}
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-2">{eventTypeLabel(row.event_type)}</td>
                <td className="px-3 py-2">{row.sales?.invoice_no ?? '—'}</td>
                <td className="px-3 py-2 tabular-nums">{formatBDT(Number(row.base_amount))}</td>
                <td className="px-3 py-2 tabular-nums">
                  {formatBDT(Number(row.commission_amount))}
                  {Number(row.reversed_amount ?? 0) > 0 ? (
                    <span className="mt-0.5 block text-[11px] text-[#9CA3AF]">
                      −{formatBDT(Number(row.reversed_amount))} reversed
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                      commissionStatusClass(row.status, Number(row.reversed_amount ?? 0)),
                    )}
                  >
                    {statusLabel(row.status, Number(row.reversed_amount ?? 0))}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {isPayable(row.status) ? (
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
                <p className="truncate text-xs text-[#6B7280]">
                  {row.product_name ?? '—'}
                  {row.variant_name ? ` · ${row.variant_name}` : ''}
                </p>
                <p className="text-xs text-[#6B7280]">
                  {eventTypeLabel(row.event_type)} · {row.sales?.invoice_no ?? '—'}
                </p>
              </div>
              <p className="shrink-0 text-sm font-bold tabular-nums">
                {formatBDT(Number(row.commission_amount))}
              </p>
            </div>
            <p className="mt-2 text-xs text-[#6B7280] capitalize">
              Status: {statusLabel(row.status, Number(row.reversed_amount ?? 0))}
              {Number(row.reversed_amount ?? 0) > 0
                ? ` · −${formatBDT(Number(row.reversed_amount))} reversed`
                : ''}
            </p>
            {isPayable(row.status) ? (
              <div className="mt-3">
                <PermissionGate permission="sales.commission.pay">
                  <Button
                    className="min-h-11 w-full"
                    disabled={!defaultAccount}
                    onClick={() => pay.mutate({ id: row.id, accountId: defaultAccount })}
                  >
                    Pay
                  </Button>
                </PermissionGate>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {!isLoading && data.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-[#6B7280]">
          No commissions yet. Complete a POS sale as a user linked to an employee with an active
          commission structure.
        </p>
      ) : null}
    </div>
  )
}
