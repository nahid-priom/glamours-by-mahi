import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commissionsRepository } from '../repositories/commissions.repository'
import type { SalesCommissionRow } from '../repositories/commissions.repository'
import { listEmployees } from '@/features/hr/repositories/employees.repository'
import { AppDateField } from '@/components/date-picker'
import { FinancialAccountSelectField } from '@/components/payments/FinancialAccountSelectField'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/features/auth/auth-session'
import { formatBDT, formatDateShort } from '@/lib/format'
import { queryKeys } from '@/lib/query/keys'
import { cn } from '@/lib/utils'
import { toastRpcError } from '@/lib/errors/rpc-error'

function employeeName(row: SalesCommissionRow) {
  if (row.employees?.full_name) {
    const code = row.employees.employee_code ? ` (${row.employees.employee_code})` : ''
    return `${row.employees.full_name}${code}`
  }
  if (row.profiles?.full_name) return row.profiles.full_name
  if (row.needs_employee_link) return 'Needs employee link'
  return '—'
}

function isPayable(status: string) {
  return status === 'approved'
}

function isApprovable(status: string) {
  return status === 'pending'
}

function statusLabel(status: string, reversedAmount = 0) {
  if (status === 'cancelled') return 'rejected'
  if (status === 'reversed') return 'reversed'
  if (reversedAmount > 0 && (status === 'pending' || status === 'approved' || status === 'paid')) {
    return 'partially reversed'
  }
  return status
}

function commissionStatusClass(status: string, reversedAmount = 0) {
  if (status === 'cancelled') return 'bg-rose-50 text-rose-800'
  if (status === 'reversed') return 'bg-rose-100 text-rose-900'
  if (reversedAmount > 0) return 'bg-amber-100 text-amber-900'
  if (status === 'pending') return 'bg-amber-50 text-amber-800'
  if (status === 'approved') return 'bg-blue-100 text-blue-900'
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

function invalidateCommissionCaches(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['sales-commissions'] })
  void qc.invalidateQueries({ queryKey: ['sales-commissions-summary'] })
  void qc.invalidateQueries({ queryKey: ['sale-commission-audit'] })
  void qc.invalidateQueries({ queryKey: ['staff-commission-summary'] })
  void qc.invalidateQueries({ queryKey: ['staff-commission-entries'] })
  void qc.invalidateQueries({ queryKey: ['employee-commissions'] })
  void qc.invalidateQueries({ queryKey: ['staff-dashboard'] })
  void qc.invalidateQueries({ queryKey: queryKeys.dashboard({}) })
}

const PAGE_SIZE = 50

export function SalesCommissionsPage() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const { activeBranchId } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [payAccountId, setPayAccountId] = useState<string>('')
  const [employeeId, setEmployeeId] = useState(searchParams.get('employee') || 'all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string[]>([])
  const [detailId, setDetailId] = useState<string | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => {
    const fromUrl = searchParams.get('employee')
    if (fromUrl && fromUrl !== employeeId) setEmployeeId(fromUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once from URL
  }, [])

  const filters = {
    employeeId: employeeId === 'all' ? null : employeeId,
    status: statusFilter === 'all' ? null : statusFilter,
    dateFrom: dateFrom || null,
    dateTo: dateTo || null,
    branchId: activeBranchId,
    page,
    pageSize: PAGE_SIZE,
  }

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.salesCommissions(filters),
    queryFn: () => commissionsRepository.listCommissions(filters),
  })

  const summaryFilters = {
    status: filters.status,
    employeeId: filters.employeeId,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    branchId: filters.branchId,
  }

  const { data: summary } = useQuery({
    queryKey: queryKeys.salesCommissionsSummary(summaryFilters),
    queryFn: () => commissionsRepository.summarizeSalesCommissions(summaryFilters),
  })

  const rows = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const { data: employeesData } = useQuery({
    queryKey: queryKeys.employees({ status: 'active', pageSize: 200 }),
    queryFn: () => listEmployees({ status: 'active', pageSize: 200 }),
  })

  const { data: accounts = [] } = useQuery({
    queryKey: queryKeys.commissionAccounts,
    queryFn: () => commissionsRepository.listFinancialAccounts(),
  })

  const employees = employeesData?.items ?? []
  const detail = rows.find((r) => r.id === detailId) ?? null

  const kpis = {
    pending: Number(summary?.pending ?? 0),
    approved: Number(summary?.approved ?? 0),
    paid: Number(summary?.paid ?? 0),
    reversed: Number(summary?.reversed ?? 0),
    recoverable: Number(summary?.recoverable ?? 0),
    net: Number(summary?.net_earned ?? 0),
    exceptions: Number(summary?.exceptions ?? 0),
  }

  const pendingIds = rows.filter((r) => isApprovable(r.status)).map((r) => r.id)
  const selectedPending = selected.filter((id) => pendingIds.includes(id))

  const approve = useMutation({
    mutationFn: (id: string) => commissionsRepository.approveCommission(id),
    onSuccess: () => {
      toast('Commission approved')
      invalidateCommissionCaches(qc)
    },
    onError: (e) => toastRpcError(toast, e, 'Could not approve'),
  })

  const bulkApprove = useMutation({
    mutationFn: (ids: string[]) => commissionsRepository.approveCommissionsBulk(ids),
    onSuccess: (results) => {
      const ok = results.filter((r) => r.ok).length
      const fail = results.length - ok
      toast(
        fail ? `Approved ${ok}, failed ${fail}` : `Approved ${ok} commission(s)`,
        fail ? 'error' : 'success',
      )
      setSelected([])
      setBulkOpen(false)
      invalidateCommissionCaches(qc)
    },
    onError: (e) => toastRpcError(toast, e, 'Bulk approve failed'),
  })

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      commissionsRepository.rejectCommission(id, reason),
    onSuccess: () => {
      toast('Commission rejected')
      setRejectId(null)
      setRejectReason('')
      setDetailId(null)
      invalidateCommissionCaches(qc)
    },
    onError: (e) => toastRpcError(toast, e, 'Could not reject'),
  })

  const pay = useMutation({
    mutationFn: ({ id, accountId }: { id: string; accountId: string }) =>
      commissionsRepository.payCommission(id, accountId),
    onSuccess: () => {
      toast('Commission paid')
      invalidateCommissionCaches(qc)
    },
    onError: (e) => toastRpcError(toast, e, 'Could not pay'),
  })

  /** Explicit selection only — never fall back to accounts[0]. */
  const defaultAccount = payAccountId || ''

  function onEmployeeChange(value: string) {
    setEmployeeId(value)
    setPage(1)
    setSelected([])
    const next = new URLSearchParams(searchParams)
    if (value === 'all') next.delete('employee')
    else next.set('employee', value)
    setSearchParams(next, { replace: true })
  }

  function toggleSelected(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function renderActions(row: SalesCommissionRow, fullWidth = false) {
    return (
      <div className={cn('flex flex-wrap gap-1', fullWidth && 'flex-col')}>
        {isApprovable(row.status) ? (
          <PermissionGate permission={['sales.commission.manage', 'sales.commission.approve']}>
            <Button
              size="sm"
              variant="outline"
              className={fullWidth ? 'min-h-11 w-full' : undefined}
              disabled={approve.isPending}
              onClick={() => approve.mutate(row.id)}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className={fullWidth ? 'min-h-11 w-full text-[#E11D48]' : 'text-[#E11D48]'}
              disabled={reject.isPending}
              onClick={() => {
                setRejectId(row.id)
                setRejectReason('')
              }}
            >
              Reject
            </Button>
          </PermissionGate>
        ) : null}
        {isPayable(row.status) ? (
          <PermissionGate permission="sales.commission.pay">
            <Button
              size="sm"
              className={fullWidth ? 'min-h-11 w-full' : undefined}
              disabled={!defaultAccount || pay.isPending}
              onClick={() => pay.mutate({ id: row.id, accountId: defaultAccount })}
            >
              Pay
            </Button>
          </PermissionGate>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          className={fullWidth ? 'min-h-11 w-full' : undefined}
          onClick={() => setDetailId(row.id)}
        >
          Detail
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#111827]">Commissions</h1>
        <p className="text-sm text-[#6B7280]">
          Accrued → Pending → Approved → Paid. Reject cancels pending only. Date filter uses
          created_at (Asia/Dhaka). Never pay twice — RPC enforces status.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {[
          { label: 'Pending', value: kpis.pending },
          { label: 'Approved', value: kpis.approved },
          { label: 'Paid', value: kpis.paid },
          { label: 'Reversed', value: kpis.reversed },
          { label: 'Net earned', value: kpis.net },
          { label: 'Recoverable', value: kpis.recoverable },
          { label: 'Open exceptions', value: kpis.exceptions, raw: true },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-[#6B7280]">{kpi.label}</p>
            <p className="text-lg font-bold tabular-nums">
              {'raw' in kpi && kpi.raw ? kpi.value : formatBDT(kpi.value)}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span className="text-[#6B7280]">Employee</span>
          <Select value={employeeId} onValueChange={onEmployeeChange}>
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
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v)
              setPage(1)
              setSelected([])
            }}
          >
            <SelectTrigger className="h-9 min-w-[10rem]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="reversed">Reversed</SelectItem>
              <SelectItem value="cancelled">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </label>

        <div className="space-y-1 text-sm">
          <span className="text-[#6B7280]">From</span>
          <AppDateField
            value={dateFrom}
            onChange={(v) => {
              setDateFrom(v)
              setPage(1)
            }}
          />
        </div>
        <div className="space-y-1 text-sm">
          <span className="text-[#6B7280]">To</span>
          <AppDateField
            value={dateTo}
            onChange={(v) => {
              setDateTo(v)
              setPage(1)
            }}
          />
        </div>

        <FinancialAccountSelectField
          label="Payment account"
          className="min-w-[12rem] space-y-1 text-sm"
          value={defaultAccount || null}
          onChange={(id) => setPayAccountId(id ?? '')}
          accounts={accounts}
          showBalance={false}
          required={false}
        />

        <PermissionGate permission={['sales.commission.manage', 'sales.commission.approve']}>
          <Button
            size="sm"
            disabled={!selectedPending.length || bulkApprove.isPending}
            onClick={() => setBulkOpen(true)}
          >
            Bulk approve ({selectedPending.length})
          </Button>
        </PermissionGate>
      </div>

      {isLoading ? <p className="text-sm text-[#6B7280]">Loading…</p> : null}
      {error ? (
        <p className="text-sm text-[#E11D48]">
          {error instanceof Error ? error.message : 'Could not load commissions.'}
        </p>
      ) : null}

      <div className="hidden overflow-x-auto rounded-xl border border-border bg-white md:block">
        <table className="w-full min-w-[1040px] text-sm">
          <thead className="border-b bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
            <tr>
              <th className="px-3 py-2 text-left">
                <input
                  type="checkbox"
                  aria-label="Select all pending"
                  checked={pendingIds.length > 0 && pendingIds.every((id) => selected.includes(id))}
                  onChange={(e) => {
                    if (e.target.checked) setSelected(pendingIds)
                    else setSelected((prev) => prev.filter((id) => !pendingIds.includes(id)))
                  }}
                />
              </th>
              <th className="px-3 py-2 text-left">Employee</th>
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-left">Event</th>
              <th className="px-3 py-2 text-left">Invoice</th>
              <th className="px-3 py-2 text-left">Base</th>
              <th className="px-3 py-2 text-left">Commission</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                <td className="px-3 py-2">
                  {isApprovable(row.status) ? (
                    <input
                      type="checkbox"
                      checked={selected.includes(row.id)}
                      onChange={() => toggleSelected(row.id)}
                      aria-label={`Select ${row.id}`}
                    />
                  ) : null}
                </td>
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
                <td className="px-3 py-2 text-xs text-[#6B7280]">
                  {formatDateShort(row.created_at)}
                </td>
                <td className="px-3 py-2">{renderActions(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 md:hidden">
        {rows.map((row) => (
          <div key={row.id} className="rounded-xl border border-border bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                {isApprovable(row.status) ? (
                  <label className="mb-1 flex items-center gap-2 text-xs text-[#6B7280]">
                    <input
                      type="checkbox"
                      checked={selected.includes(row.id)}
                      onChange={() => toggleSelected(row.id)}
                    />
                    Select for bulk approve
                  </label>
                ) : null}
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
            </p>
            <div className="mt-3">{renderActions(row, true)}</div>
          </div>
        ))}
      </div>

      {!isLoading && rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-[#6B7280]">
          No commissions for these filters.
        </p>
      ) : null}

      {total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[#6B7280]">
          <span>
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="flex items-center px-2">
              Page {page} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      {detail ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-start justify-between gap-2">
              <h2 className="text-lg font-semibold">Commission detail</h2>
              <Button size="sm" variant="ghost" onClick={() => setDetailId(null)}>
                Close
              </Button>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-[#6B7280]">ID</dt>
                <dd className="font-mono text-xs">{detail.id}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#6B7280]">Employee</dt>
                <dd className="text-right font-medium">{employeeName(detail)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#6B7280]">Invoice</dt>
                <dd>{detail.sales?.invoice_no ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#6B7280]">Amount</dt>
                <dd className="font-semibold">{formatBDT(Number(detail.commission_amount))}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#6B7280]">Status</dt>
                <dd className="capitalize">
                  {statusLabel(detail.status, Number(detail.reversed_amount ?? 0))}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#6B7280]">Created</dt>
                <dd>{formatDateShort(detail.created_at)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#6B7280]">Approved</dt>
                <dd>{detail.approved_at ? formatDateShort(detail.approved_at) : '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#6B7280]">Paid</dt>
                <dd>{detail.paid_at ? formatDateShort(detail.paid_at) : '—'}</dd>
              </div>
              {detail.notes ? (
                <div>
                  <dt className="text-[#6B7280]">Notes / history</dt>
                  <dd className="mt-1 whitespace-pre-wrap rounded-lg bg-[#F9FAFB] p-2 text-xs">
                    {detail.notes}
                  </dd>
                </div>
              ) : null}
            </dl>
            {isApprovable(detail.status) ? (
              <PermissionGate permission={['sales.commission.manage', 'sales.commission.approve']}>
                <div className="mt-4 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={approve.isPending}
                    onClick={() => approve.mutate(detail.id)}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-[#E11D48]"
                    disabled={reject.isPending}
                    onClick={() => {
                      setRejectId(detail.id)
                      setRejectReason('')
                    }}
                  >
                    Reject
                  </Button>
                </div>
              </PermissionGate>
            ) : null}
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title="Bulk approve commissions"
        description={`Approve ${selectedPending.length} pending commission(s)? Each row uses server approval rules; failures are reported individually.`}
        confirmLabel={bulkApprove.isPending ? 'Approving…' : 'Approve selected'}
        loading={bulkApprove.isPending}
        onConfirm={() => bulkApprove.mutate(selectedPending)}
      />

      <Dialog
        open={Boolean(rejectId)}
        onOpenChange={(open) => {
          if (!open) {
            setRejectId(null)
            setRejectReason('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject commission</DialogTitle>
            <DialogDescription>
              Pending commission will be cancelled. Reason is optional and stored in notes.
            </DialogDescription>
          </DialogHeader>
          <label className="block space-y-1 text-sm">
            <span className="text-[#6B7280]">Reason</span>
            <textarea
              className="min-h-[88px] w-full rounded-md border border-border px-3 py-2 text-sm"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Optional rejection reason"
            />
          </label>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectId(null)
                setRejectReason('')
              }}
              disabled={reject.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!rejectId || reject.isPending}
              onClick={() => {
                if (!rejectId) return
                reject.mutate({ id: rejectId, reason: rejectReason.trim() || undefined })
              }}
            >
              {reject.isPending ? 'Rejecting…' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
