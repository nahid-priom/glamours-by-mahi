import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, UserPlus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatBDT, formatDateShort } from '@/lib/format'
import { queryKeys } from '@/lib/query/keys'
import { supabase } from '@/lib/supabase/client'
import { commissionsRepository } from '@/features/sales/repositories/commissions.repository'
import { listStaffTargets } from '@/features/staff/repositories/staff.repository'
import { listSalaryStructures, listEmployeeAdvances } from '../repositories/payroll.repository'
import {
  getEmployee,
  softDeleteEmployee,
  updateEmployee,
} from '../repositories/employees.repository'
import {
  EmployeeFormFields,
  emptyEmployeeForm,
  formToEmployeeInput,
  type EmployeeFormState,
} from '../components/EmployeeFormFields'

type TabId = 'profile' | 'attendance' | 'leave' | 'salary' | 'commission' | 'targets' | 'advances'

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'profile', label: 'Profile' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'leave', label: 'Leave' },
  { id: 'salary', label: 'Salary' },
  { id: 'commission', label: 'Commission' },
  { id: 'targets', label: 'Targets' },
  { id: 'advances', label: 'Advances' },
]

export function EmployeeDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [form, setForm] = useState<EmployeeFormState>(emptyEmployeeForm)
  const [tab, setTab] = useState<TabId>('profile')

  const { data: employee, isLoading, error } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => getEmployee(id),
    enabled: Boolean(id),
  })

  const { data: branches = [] } = useQuery({
    queryKey: queryKeys.branches,
    queryFn: async () => {
      const { data, error: branchError } = await supabase
        .from('branches')
        .select('id, name')
        .is('deleted_at', null)
        .eq('is_active', true)
        .order('name')
      if (branchError) throw branchError
      return data ?? []
    },
  })

  const { data: attendance = [] } = useQuery({
    queryKey: ['employee-attendance', id],
    enabled: Boolean(id) && tab === 'attendance',
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('attendance_records')
        .select('id, work_date, status, first_in, last_out, late_minutes')
        .eq('employee_id', id)
        .is('deleted_at', null)
        .order('work_date', { ascending: false })
        .limit(30)
      if (err) throw err
      return data ?? []
    },
  })

  const { data: leaves = [] } = useQuery({
    queryKey: ['employee-leave', id],
    enabled: Boolean(id) && tab === 'leave',
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('leave_requests')
        .select('id, leave_type, start_date, end_date, status, created_at')
        .eq('employee_id', id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(30)
      if (err) throw err
      return data ?? []
    },
  })

  const { data: structures = [] } = useQuery({
    queryKey: queryKeys.salaryStructures,
    enabled: tab === 'salary',
    queryFn: listSalaryStructures,
  })

  const { data: commissions = [] } = useQuery({
    queryKey: queryKeys.salesCommissions({ employeeId: id }),
    enabled: Boolean(id) && tab === 'commission',
    queryFn: () => commissionsRepository.listCommissions({ employeeId: id }),
  })

  const { data: targets } = useQuery({
    queryKey: ['employee-targets', employee?.profile_id],
    enabled: Boolean(employee?.profile_id) && tab === 'targets',
    queryFn: () => listStaffTargets({ staff_user_id: employee!.profile_id!, limit: 50 }),
  })

  const { data: advances = [] } = useQuery({
    queryKey: queryKeys.employeeAdvances,
    enabled: tab === 'advances',
    queryFn: listEmployeeAdvances,
  })

  useEffect(() => {
    if (!employee) return
    setForm({
      employee_code: employee.employee_code,
      full_name: employee.full_name,
      phone: employee.phone ?? '',
      email: employee.email ?? '',
      branch_id: employee.branch_id ?? '',
      department: employee.department ?? '',
      designation: employee.designation ?? '',
      basic_salary: String(employee.basic_salary ?? 0),
      joining_date: employee.joining_date ?? '',
      status: (employee.status as EmployeeFormState['status']) || 'active',
      commission_eligible: Boolean(employee.commission_eligible),
      include_commission_in_payroll: Boolean(employee.include_commission_in_payroll ?? true),
      notes: employee.notes ?? '',
    })
  }, [employee])

  const save = useMutation({
    mutationFn: async () => {
      const payload = formToEmployeeInput(form)
      if (!payload.employee_code.trim()) throw new Error('Employee code is required')
      if (!payload.full_name.trim()) throw new Error('Full name is required')
      return updateEmployee(id, payload)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['employee', id] })
      void qc.invalidateQueries({ queryKey: ['employees'] })
      toast('Employee updated')
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const remove = useMutation({
    mutationFn: () => softDeleteEmployee(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['employees'] })
      toast('Employee removed')
      navigate('/hr/employees', { replace: true })
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-[#6B7280]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading employee…
      </div>
    )
  }

  if (error || !employee) {
    return (
      <EmptyState
        title="Employee not found"
        description={error instanceof Error ? error.message : 'This record may have been removed.'}
        actionLabel="Back to list"
        onAction={() => navigate('/hr/employees')}
      />
    )
  }

  const linked = Boolean(employee.profile_id)
  const employeeStructures = structures.filter((s) => s.employee_id === id)
  const employeeAdvances = advances.filter((a) => a.employee_id === id)

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/hr/employees">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Employees
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-[#111111]">{employee.full_name}</h1>
          <p className="mt-1 font-mono text-sm text-[#6B7280]">{employee.employee_code}</p>
        </div>
        <Badge variant={employee.status === 'active' ? 'success' : 'default'}>{employee.status}</Badge>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b pb-px">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`shrink-0 rounded-t-lg px-3 py-2 text-sm font-medium ${
              tab === t.id
                ? 'border border-b-white border-border bg-white text-[#E11D48]'
                : 'text-[#6B7280] hover:text-[#111]'
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' ? (
        <>
          <div className="rounded-2xl border bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-[#111111]">Login account</p>
                <p className="text-xs text-[#6B7280]">
                  {linked
                    ? `Linked to auth profile ${employee.profile_id}`
                    : 'No login yet — create one without orphaning this employee record.'}
                </p>
              </div>
              {!linked ? (
                <PermissionGate permission={['administration.users.create', 'settings.manage']}>
                  <Button asChild size="sm">
                    <Link
                      to={`/administration/users/new?employee_id=${employee.id}`}
                      className="inline-flex items-center gap-1.5"
                    >
                      <UserPlus className="h-4 w-4" />
                      Create login
                    </Link>
                  </Button>
                </PermissionGate>
              ) : (
                <Button asChild size="sm" variant="outline">
                  <Link to={`/administration/users/${employee.profile_id}`}>Open user</Link>
                </Button>
              )}
            </div>
            <p className="text-xs text-[#6B7280]">
              Branch: {employee.branch_name ?? '—'} · Salary: {formatBDT(Number(employee.basic_salary))}
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-[#111111]">Edit profile</h2>
            <EmployeeFormFields form={form} setForm={setForm} branches={branches} />
            <div className="mt-4 flex flex-wrap justify-between gap-2">
              <PermissionGate permission="hr.employee.update">
                <Button
                  variant="outline"
                  className="text-[#E11D48]"
                  onClick={() => {
                    if (window.confirm(`Remove ${employee.full_name}?`)) remove.mutate()
                  }}
                  disabled={remove.isPending}
                >
                  Soft delete
                </Button>
              </PermissionGate>
              <PermissionGate permission="hr.employee.update">
                <Button onClick={() => save.mutate()} disabled={save.isPending}>
                  {save.isPending ? 'Saving…' : 'Save changes'}
                </Button>
              </PermissionGate>
            </div>
          </div>
        </>
      ) : null}

      {tab === 'attendance' ? (
        <section className="rounded-2xl border bg-white p-4">
          {attendance.length === 0 ? (
            <EmptyState title="No attendance rows" description="Recent attendance will appear here." />
          ) : (
            <ul className="divide-y text-sm">
              {attendance.map((row) => (
                <li key={row.id} className="flex justify-between gap-2 py-2">
                  <span>{row.work_date}</span>
                  <span className="capitalize text-[#6B7280]">{row.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === 'leave' ? (
        <section className="rounded-2xl border bg-white p-4">
          {leaves.length === 0 ? (
            <EmptyState title="No leave requests" description="Leave history will appear here." />
          ) : (
            <ul className="divide-y text-sm">
              {leaves.map((row) => (
                <li key={row.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>
                    {row.leave_type} · {row.start_date} → {row.end_date}
                  </span>
                  <span className="capitalize text-[#6B7280]">{row.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === 'salary' ? (
        <section className="rounded-2xl border bg-white p-4">
          <div className="mb-3 flex justify-between">
            <h2 className="text-sm font-semibold">Salary structures</h2>
            <Button asChild size="sm" variant="outline">
              <Link to="/hr/payroll/salary-structures">Manage</Link>
            </Button>
          </div>
          {employeeStructures.length === 0 ? (
            <EmptyState
              title="No structure assigned"
              description={`Basic salary on profile: ${formatBDT(Number(employee.basic_salary))}`}
            />
          ) : (
            <ul className="divide-y text-sm">
              {employeeStructures.map((s) => (
                <li key={s.id} className="py-2">
                  <p className="font-medium">
                    {formatBDT(Number(s.basic_salary))} · {s.salary_type}
                  </p>
                  <p className="text-xs text-[#6B7280]">
                    {s.effective_from} → {s.effective_to ?? 'open'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === 'commission' ? (
        <section className="rounded-2xl border bg-white p-4">
          <div className="mb-3 flex justify-between">
            <h2 className="text-sm font-semibold">Commission history</h2>
            <Button asChild size="sm" variant="outline">
              <Link to={`/hr/commissions`}>Open commissions</Link>
            </Button>
          </div>
          {commissions.length === 0 ? (
            <EmptyState title="No commissions" description="Accruals will appear after eligible sales." />
          ) : (
            <ul className="divide-y text-sm">
              {commissions.slice(0, 40).map((c) => (
                <li key={c.id} className="flex justify-between gap-2 py-2">
                  <div>
                    <p className="font-medium">{formatBDT(Number(c.commission_amount))}</p>
                    <p className="text-xs text-[#6B7280]">
                      {c.sales?.invoice_no ?? '—'} · {formatDateShort(c.created_at)}
                    </p>
                  </div>
                  <span className="capitalize text-[#6B7280]">{c.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === 'targets' ? (
        <section className="rounded-2xl border bg-white p-4">
          {!employee.profile_id ? (
            <EmptyState
              title="No linked login"
              description="Assign a login before staff targets can be attributed."
            />
          ) : (targets?.items ?? []).length === 0 ? (
            <EmptyState title="No targets" description="Assign targets from Administration → Targets." />
          ) : (
            <ul className="divide-y text-sm">
              {(targets?.items ?? []).map((t) => {
                const pct =
                  Number(t.sales_amount) > 0
                    ? Math.min(100, Math.round((Number(t.achieved_sales) / Number(t.sales_amount)) * 100))
                    : 0
                return (
                  <li key={t.id} className="py-2">
                    <p className="font-medium capitalize">
                      {t.target_period} · {formatBDT(Number(t.sales_amount))}
                    </p>
                    <p className="text-xs text-[#6B7280]">
                      Achieved {formatBDT(Number(t.achieved_sales))} ({pct}%) · {t.starts_at} →{' '}
                      {t.ends_at}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      ) : null}

      {tab === 'advances' ? (
        <section className="rounded-2xl border bg-white p-4">
          <div className="mb-3 flex justify-between">
            <h2 className="text-sm font-semibold">Advances</h2>
            <Button asChild size="sm" variant="outline">
              <Link to="/hr/payroll/advances">Manage advances</Link>
            </Button>
          </div>
          {employeeAdvances.length === 0 ? (
            <EmptyState title="No advances" description="Salary advances for this employee appear here." />
          ) : (
            <ul className="divide-y text-sm">
              {employeeAdvances.map((a) => (
                <li key={a.id} className="flex justify-between gap-2 py-2">
                  <div>
                    <p className="font-medium">{formatBDT(Number(a.amount))}</p>
                    <p className="text-xs text-[#6B7280]">
                      Remaining {formatBDT(Number(a.remaining_amount))} · {formatDateShort(a.created_at)}
                    </p>
                  </div>
                  <span className="capitalize text-[#6B7280]">{a.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  )
}
