import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Calculator,
  CheckCircle2,
  FileText,
  Loader2,
  Send,
  Wallet,
  XCircle,
} from 'lucide-react'
import { FinancialAccountSelectField } from '@/components/payments/FinancialAccountSelectField'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { KpiGrid } from '@/components/common/KpiGrid'
import { EmptyState } from '@/components/shared/EmptyState'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { formatBDT, formatDateShort } from '@/lib/format'
import { queryKeys } from '@/lib/query/keys'
import {
  PAYROLL_STATUS_VARIANT,
} from '../payroll/lib/payroll-filters'
import {
  amountInWordsBDT,
  buildPayslipLines,
  type AttendanceSnapshot,
} from '../payroll/lib/payslip'
import { usePayrollMutations } from '../payroll/hooks/use-payroll-mutations'
import {
  getPayrollRun,
  listFinancialAccounts,
  listPayrollApprovalLogs,
  listPayrollItems,
  listPayrollPayments,
  type PayrollItemListItem,
} from '../repositories/payroll.repository'

const TAB_IDS = [
  'summary',
  'employees',
  'attendance',
  'earnings',
  'deductions',
  'payments',
  'accounting',
  'activity',
] as const

type TabId = (typeof TAB_IDS)[number]

function resolveTab(pathname: string, search: string): TabId {
  if (pathname.endsWith('/review')) return 'summary'
  if (pathname.endsWith('/payments')) return 'payments'
  const tab = new URLSearchParams(search).get('tab')
  return TAB_IDS.includes(tab as TabId) ? (tab as TabId) : 'summary'
}

function itemDeductions(row: PayrollItemListItem) {
  return (
    Number(row.attendance_deduction) +
    Number(row.leave_deduction) +
    Number(row.other_deductions)
  )
}

function attendanceFromItem(row: PayrollItemListItem): AttendanceSnapshot {
  return (row as { attendance_snapshot?: AttendanceSnapshot }).attendance_snapshot ?? {}
}

export function PayrollRunDetailPage() {
  const { id: runId = '' } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const activeTab = resolveTab(location.pathname, location.search)
  const { calculate, submitReview, approve, reject, pay } = usePayrollMutations(runId)
  const [accountId, setAccountId] = useState('')
  const [rejectReason, setRejectReason] = useState('')

  const { data: run, isLoading: runLoading, error: runError } = useQuery({
    queryKey: queryKeys.payrollRun(runId),
    queryFn: () => getPayrollRun(runId),
    enabled: Boolean(runId),
  })

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: queryKeys.payrollItems(runId),
    queryFn: () => listPayrollItems(runId),
    enabled: Boolean(runId),
  })

  const { data: logs = [] } = useQuery({
    queryKey: queryKeys.payrollApprovalLogs(runId),
    queryFn: () => listPayrollApprovalLogs(runId),
    enabled: Boolean(runId),
  })

  const { data: payments = [] } = useQuery({
    queryKey: queryKeys.payrollPayments(runId),
    queryFn: () => listPayrollPayments(runId),
    enabled: Boolean(runId),
  })

  const { data: accounts = [] } = useQuery({
    queryKey: ['payroll-financial-accounts'],
    queryFn: listFinancialAccounts,
    enabled: Boolean(run?.status && ['approved', 'payment_pending', 'partially_paid'].includes(run.status)),
  })

  const earningsRows = useMemo(
    () =>
      items.map((row) => {
        const lines = buildPayslipLines({
          basic_salary: row.basic_salary,
          allowances: row.allowances,
          overtime: row.overtime,
          bonus: row.bonus,
          commission_amount: Number((row as { commission_amount?: number }).commission_amount ?? 0),
          attendance_deduction: 0,
          leave_deduction: 0,
          other_deductions: 0,
        })
        const total = lines.earnings.reduce((s, l) => s + l.amount, 0)
        return { row, lines: lines.earnings, total }
      }),
    [items],
  )

  const deductionRows = useMemo(
    () =>
      items.map((row) => {
        const lines = buildPayslipLines({
          basic_salary: row.basic_salary,
          allowances: row.allowances,
          overtime: row.overtime,
          bonus: row.bonus,
          commission_amount: Number((row as { commission_amount?: number }).commission_amount ?? 0),
          attendance_deduction: row.attendance_deduction,
          leave_deduction: row.leave_deduction,
          other_deductions: row.other_deductions,
          breakdown: (row as { breakdown?: Record<string, unknown> }).breakdown,
        })
        const total = lines.deductions.reduce((s, l) => s + l.amount, 0)
        return { row, lines: lines.deductions, total }
      }),
    [items],
  )

  const onTabChange = (tab: string) => {
    navigate(`/hr/payroll/${runId}?tab=${tab}`, { replace: true })
  }

  if (runLoading || itemsLoading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-[#6B7280]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading payroll run…
      </div>
    )
  }

  if (runError) {
    return (
      <EmptyState
        title="Could not load payroll"
        description={runError instanceof Error ? runError.message : 'An error occurred'}
      />
    )
  }

  if (!run) {
    return <EmptyState title="Payroll run not found" description="This run may have been removed." />
  }

  const canCalculate = ['draft', 'calculated', 'recalculation_required'].includes(run.status)
  const canSubmitReview = ['calculated', 'recalculation_required'].includes(run.status)
  const canApprove = ['calculated', 'reviewed'].includes(run.status)
  const canReject = ['calculated', 'reviewed', 'approved'].includes(run.status)
  const canPay = ['approved', 'payment_pending', 'partially_paid'].includes(run.status)
  const runExt = run as {
    total_paid?: number
    outstanding?: number
    journal_entry_id?: string | null
    payment_journal_entry_id?: string | null
    payment_date?: string | null
    notes?: string | null
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/hr/payroll">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-2xl text-[#111111]">{run.period_label}</h1>
          <p className="text-sm text-[#6B7280]">
            {run.period_start} → {run.period_end}
            {run.branch_name ? ` · ${run.branch_name}` : ' · All branches'}
            {runExt.payment_date ? ` · Pay date ${runExt.payment_date}` : ''}
          </p>
        </div>
        <Badge variant={PAYROLL_STATUS_VARIANT[run.status] ?? 'default'} className="capitalize">
          {run.status.replace(/_/g, ' ')}
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={onTabChange}>
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="earnings">Earnings</TabsTrigger>
          <TabsTrigger value="deductions">Deductions</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="accounting">Accounting</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          <KpiGrid
            items={[
              { label: 'Gross', value: formatBDT(run.total_gross) },
              { label: 'Deductions', value: formatBDT(run.total_deductions) },
              { label: 'Net pay', value: formatBDT(run.total_net) },
              { label: 'Paid', value: formatBDT(Number(runExt.total_paid ?? 0)) },
              { label: 'Outstanding', value: formatBDT(Number(runExt.outstanding ?? run.total_net)) },
              { label: 'Employees', value: String(run.employee_count) },
            ]}
          />
          {runExt.notes ? (
            <p className="rounded-xl border bg-white p-3 text-sm text-[#6B7280]">{runExt.notes}</p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <PermissionGate permission={['hr.payroll.calculate', 'hr.payroll.create']}>
              {canCalculate ? (
                <Button size="sm" disabled={calculate.isPending} onClick={() => calculate.mutate(runId)}>
                  <Calculator className="mr-1.5 h-3.5 w-3.5" />
                  {run.status === 'calculated' ? 'Recalculate' : 'Calculate'}
                </Button>
              ) : null}
            </PermissionGate>
            <PermissionGate permission="hr.payroll.review">
              {canSubmitReview ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={submitReview.isPending}
                  onClick={() => submitReview.mutate({ id: runId })}
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  Submit for review
                </Button>
              ) : null}
            </PermissionGate>
            <PermissionGate permission="hr.payroll.approve">
              {canApprove ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={approve.isPending}
                  onClick={() => approve.mutate({ id: runId })}
                >
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                  Approve
                </Button>
              ) : null}
            </PermissionGate>
            <PermissionGate permission="hr.payroll.approve">
              {canReject ? (
                <div className="flex flex-wrap items-end gap-2 rounded-xl border bg-white p-3">
                  <div>
                    <Label className="text-xs">Reject reason</Label>
                    <input
                      className="mt-1 h-9 w-[220px] rounded-lg border px-2 text-sm"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Reason for rejection"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!rejectReason.trim() || reject.isPending}
                    onClick={() => reject.mutate({ id: runId, reason: rejectReason.trim() })}
                  >
                    <XCircle className="mr-1.5 h-3.5 w-3.5" />
                    Reject
                  </Button>
                </div>
              ) : null}
            </PermissionGate>
          </div>

          <p className="text-sm text-[#6B7280]">
            Net payable in words: <span className="font-medium text-[#111111]">{amountInWordsBDT(run.total_net)}</span>
          </p>
        </TabsContent>

        <TabsContent value="employees">
          {items.length === 0 ? (
            <EmptyState
              title="No payroll items"
              description="Calculate this run to generate employee line items."
              actionLabel={canCalculate ? 'Calculate now' : undefined}
              onAction={canCalculate ? () => calculate.mutate(runId) : undefined}
            />
          ) : (
            <div className="overflow-x-auto rounded-2xl border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Gross</TableHead>
                    <TableHead>Deductions</TableHead>
                    <TableHead>Net</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Payslip</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{row.employee_name}</p>
                          <p className="text-xs text-[#6B7280]">{row.employee_code}</p>
                        </div>
                      </TableCell>
                      <TableCell>{row.department ?? '—'}</TableCell>
                      <TableCell>
                        {formatBDT(Number((row as { gross_salary?: number }).gross_salary ?? row.net_salary))}
                      </TableCell>
                      <TableCell>{formatBDT(itemDeductions(row))}</TableCell>
                      <TableCell className="font-semibold">{formatBDT(row.net_salary)}</TableCell>
                      <TableCell className="capitalize text-xs">
                        {(row as { payment_status?: string }).payment_status ?? 'unpaid'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/hr/payslips/${row.id}`} target="_blank" rel="noopener noreferrer">
                            <FileText className="mr-1 h-3.5 w-3.5" />
                            View
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="attendance">
          {items.length === 0 ? (
            <EmptyState title="No attendance data" description="Calculate payroll to snapshot attendance." />
          ) : (
            <div className="overflow-x-auto rounded-2xl border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Present</TableHead>
                    <TableHead>Absent</TableHead>
                    <TableHead>Leave</TableHead>
                    <TableHead>Payable days</TableHead>
                    <TableHead>Overtime (min)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row) => {
                    const att = attendanceFromItem(row)
                    return (
                      <TableRow key={row.id}>
                        <TableCell>{row.employee_name}</TableCell>
                        <TableCell>{att.present ?? '—'}</TableCell>
                        <TableCell>{att.absent ?? '—'}</TableCell>
                        <TableCell>
                          {(att.paid_leave ?? 0) + (att.unpaid_leave ?? 0) || '—'}
                        </TableCell>
                        <TableCell>{att.payable_days ?? '—'}</TableCell>
                        <TableCell>{att.overtime_minutes ?? '—'}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="earnings">
          <div className="overflow-x-auto rounded-2xl border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Components</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {earningsRows.map(({ row, lines, total }) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.employee_name}</TableCell>
                    <TableCell>
                      <div className="space-y-0.5 text-xs">
                        {lines.map((l) => (
                          <div key={l.code} className="flex justify-between gap-4">
                            <span>{l.name}</span>
                            <span>{formatBDT(l.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatBDT(total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="deductions">
          <div className="overflow-x-auto rounded-2xl border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Components</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deductionRows.map(({ row, lines, total }) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.employee_name}</TableCell>
                    <TableCell>
                      {lines.length === 0 ? (
                        <span className="text-xs text-[#6B7280]">No deductions</span>
                      ) : (
                        <div className="space-y-0.5 text-xs">
                          {lines.map((l) => (
                            <div key={l.code} className="flex justify-between gap-4">
                              <span>{l.name}</span>
                              <span>{formatBDT(l.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatBDT(total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <PermissionGate permission="hr.payroll.pay">
            {canPay ? (
              <div className="flex flex-wrap items-end gap-2 rounded-xl border bg-white p-3">
                <FinancialAccountSelectField
                  label="Pay from account"
                  className="min-w-[12rem] space-y-1"
                  value={accountId || null}
                  onChange={(id) => setAccountId(id ?? '')}
                  accounts={accounts}
                  showBalance={false}
                />
                <Button
                  size="sm"
                  disabled={!accountId || pay.isPending}
                  onClick={() =>
                    pay.mutate({
                      payroll_run_id: runId,
                      financial_account_id: accountId,
                      client_txn_key: crypto.randomUUID(),
                    })
                  }
                >
                  <Wallet className="mr-1.5 h-3.5 w-3.5" />
                  Pay payroll
                </Button>
              </div>
            ) : null}
          </PermissionGate>

          {payments.length === 0 ? (
            <EmptyState title="No payments recorded" description="Approved payroll can be paid from a financial account." />
          ) : (
            <div className="overflow-x-auto rounded-2xl border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{formatDateShort(p.paid_at)}</TableCell>
                      <TableCell>{p.financial_accounts?.name ?? '—'}</TableCell>
                      <TableCell className="capitalize">{p.method}</TableCell>
                      <TableCell>{p.reference ?? '—'}</TableCell>
                      <TableCell className="text-right font-semibold">{formatBDT(p.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="accounting" className="space-y-3">
          <div className="rounded-2xl border bg-white p-4 text-sm">
            <p>
              <span className="text-[#6B7280]">Accrual journal entry:</span>{' '}
              {runExt.journal_entry_id ? (
                <Link className="text-primary underline" to={`/accounting/transactions?ref=${runExt.journal_entry_id}`}>
                  {runExt.journal_entry_id}
                </Link>
              ) : (
                'Posted on approval'
              )}
            </p>
            <p className="mt-2">
              <span className="text-[#6B7280]">Payment journal entry:</span>{' '}
              {runExt.payment_journal_entry_id ?? 'Recorded when payroll is paid'}
            </p>
          </div>
        </TabsContent>

        <TabsContent value="activity">
          {logs.length === 0 ? (
            <EmptyState title="No activity yet" description="Workflow actions will appear here." />
          ) : (
            <div className="overflow-x-auto rounded-2xl border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead>Comments</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{formatDateShort(log.created_at)}</TableCell>
                      <TableCell className="capitalize">{log.action.replace(/_/g, ' ')}</TableCell>
                      <TableCell className="text-xs">
                        {log.from_status ?? '—'} → {log.to_status ?? '—'}
                      </TableCell>
                      <TableCell>{log.profiles?.full_name ?? '—'}</TableCell>
                      <TableCell>{log.comments ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
