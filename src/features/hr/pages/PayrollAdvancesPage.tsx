import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/shared/EmptyState'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { useToast } from '@/components/ui/toast'
import { formatBDT, formatDateShort } from '@/lib/format'
import { queryKeys } from '@/lib/query/keys'
import { listEmployees } from '../repositories/employees.repository'
import { toastRpcError } from '@/lib/errors/rpc-error'
import {
  approveEmployeeAdvance,
  createEmployeeAdvance,
  disburseEmployeeAdvance,
  listEmployeeAdvances,
  listEmployeeLoans,
} from '../repositories/payroll.repository'

export function PayrollAdvancesPage() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [employeeId, setEmployeeId] = useState('')
  const [amount, setAmount] = useState('')
  const [recovery, setRecovery] = useState('')
  const [reason, setReason] = useState('')

  const { data: advances = [], isLoading: advLoading, error: advError } = useQuery({
    queryKey: queryKeys.employeeAdvances,
    queryFn: listEmployeeAdvances,
  })

  const { data: loans = [], isLoading: loanLoading, error: loanError } = useQuery({
    queryKey: queryKeys.employeeLoans,
    queryFn: listEmployeeLoans,
  })

  const { data: employeePage } = useQuery({
    queryKey: queryKeys.employees({ pageSize: 500 }),
    queryFn: () => listEmployees({ pageSize: 500 }),
  })
  const employeeItems = employeePage?.items ?? []

  const createMut = useMutation({
    mutationFn: () =>
      createEmployeeAdvance({
        employee_id: employeeId,
        amount: Number(amount),
        recovery_per_payroll: recovery ? Number(recovery) : null,
        reason: reason || null,
      }),
    onSuccess: () => {
      toast('Advance created (pending approval)')
      setAmount('')
      setRecovery('')
      setReason('')
      void qc.invalidateQueries({ queryKey: queryKeys.employeeAdvances })
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  const approveMut = useMutation({
    mutationFn: (id: string) => approveEmployeeAdvance(id),
    onSuccess: () => {
      toast('Advance approved')
      void qc.invalidateQueries({ queryKey: queryKeys.employeeAdvances })
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  const disburseMut = useMutation({
    mutationFn: (id: string) => disburseEmployeeAdvance(id),
    onSuccess: () => {
      toast('Advance disbursed — payroll will recover remaining balance')
      void qc.invalidateQueries({ queryKey: queryKeys.employeeAdvances })
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  const isLoading = advLoading || loanLoading
  const error = advError ?? loanError

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link to="/hr/payroll">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Payroll
          </Link>
        </Button>
        <h1 className="font-serif text-3xl text-[#111111]">Advances & loans</h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          Lifecycle: Create → Approve → Disburse → Recover via payroll → Settled. Disbursed /
          recovering remaining balances deduct once per payroll calculate (no double recovery).
          Cash/bank disbursement journal is operational — this screen tracks the HR recovery
          obligation.
        </p>
      </div>

      <PermissionGate permission={['hr.employee_advance.manage', 'hr.payroll.create', 'settings.manage']}>
        <form
          className="grid max-w-2xl gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            createMut.mutate()
          }}
        >
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Employee</Label>
            <select
              className="h-10 w-full rounded-md border px-3 text-sm"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              required
            >
              <option value="">Select…</option>
              {employeeItems.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} ({emp.employee_code})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Amount (BDT)</Label>
            <Input
              type="number"
              min={1}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Recovery per payroll</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={recovery}
              onChange={(e) => setRecovery(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Reason</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={createMut.isPending || !employeeId || !amount}>
              {createMut.isPending ? 'Creating…' : 'Create advance'}
            </Button>
          </div>
        </form>
      </PermissionGate>

      {error ? (
        <EmptyState
          title="Could not load data"
          description={error instanceof Error ? error.message : 'Please try again.'}
        />
      ) : isLoading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-[#6B7280]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="font-medium text-[#111111]">Salary advances</h2>
            {advances.length === 0 ? (
              <EmptyState title="No advances" description="Employee salary advances will appear here." />
            ) : (
              <div className="overflow-x-auto rounded-2xl border bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Recovered</TableHead>
                      <TableHead>Remaining</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {advances.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{row.employees?.full_name ?? '—'}</p>
                            <p className="text-xs text-[#6B7280]">{row.employees?.employee_code}</p>
                          </div>
                        </TableCell>
                        <TableCell>{formatBDT(row.amount)}</TableCell>
                        <TableCell>{formatBDT(row.recovered_amount)}</TableCell>
                        <TableCell>{formatBDT(row.remaining_amount)}</TableCell>
                        <TableCell className="capitalize">{row.status}</TableCell>
                        <TableCell>{formatDateShort(row.created_at)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {row.status === 'pending' ? (
                              <PermissionGate
                                permission={['hr.employee_advance.manage', 'hr.payroll.approve', 'settings.manage']}
                              >
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={approveMut.isPending}
                                  onClick={() => approveMut.mutate(row.id)}
                                >
                                  Approve
                                </Button>
                              </PermissionGate>
                            ) : null}
                            {row.status === 'approved' || row.status === 'pending' ? (
                              <PermissionGate
                                permission={['hr.employee_advance.manage', 'hr.payroll.pay', 'settings.manage']}
                              >
                                <Button
                                  size="sm"
                                  disabled={disburseMut.isPending}
                                  onClick={() => disburseMut.mutate(row.id)}
                                >
                                  Disburse
                                </Button>
                              </PermissionGate>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="font-medium text-[#111111]">Employee loans</h2>
            {loans.length === 0 ? (
              <EmptyState title="No loans" description="Employee loans will appear here." />
            ) : (
              <div className="overflow-x-auto rounded-2xl border bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Principal</TableHead>
                      <TableHead>Installment</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Remaining</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Start</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loans.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{row.employees?.full_name ?? '—'}</p>
                            <p className="text-xs text-[#6B7280]">{row.employees?.employee_code}</p>
                          </div>
                        </TableCell>
                        <TableCell>{formatBDT(row.principal)}</TableCell>
                        <TableCell>{formatBDT(row.installment_amount)}</TableCell>
                        <TableCell>{formatBDT(row.paid_amount)}</TableCell>
                        <TableCell>{formatBDT(row.remaining_amount)}</TableCell>
                        <TableCell className="capitalize">{row.status}</TableCell>
                        <TableCell>{row.start_date}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
