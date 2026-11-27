import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { KpiGrid } from '@/components/common/KpiGrid'
import { SearchInput } from '@/components/shared/SearchInput'
import { EmptyState } from '@/components/shared/EmptyState'
import { useAuth } from '@/features/auth/auth-session'
import { formatBDT } from '@/lib/format'
import { queryKeys } from '@/lib/query/keys'
import { toastRpcError } from '@/lib/errors/rpc-error'
import {
  createEmployee,
  getEmployeeStats,
  listEmployees,
  softDeleteEmployee,
  updateEmployee,
  type EmployeeInput,
  type EmployeeListItem,
} from '../repositories/employees.repository'

type FormState = {
  employee_code: string
  full_name: string
  phone: string
  email: string
  branch_id: string
  department: string
  designation: string
  basic_salary: string
  status: 'active' | 'inactive' | 'terminated'
}

const empty: FormState = {
  employee_code: '',
  full_name: '',
  phone: '',
  email: '',
  branch_id: '',
  department: '',
  designation: '',
  basic_salary: '0',
  status: 'active',
}

const statusVariant = {
  active: 'success' as const,
  inactive: 'default' as const,
  terminated: 'danger' as const,
}

export function EmployeesPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string>('active')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<EmployeeListItem | null>(null)
  const [form, setForm] = useState<FormState>(empty)

  const filters = {
    search,
    status: status === 'all' ? null : status,
    page,
    pageSize: 30,
  }

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.employees(filters),
    queryFn: () => listEmployees(filters),
  })

  const { data: stats } = useQuery({
    queryKey: queryKeys.employeeStats,
    queryFn: getEmployeeStats,
  })

  const { data: branches = [] } = useQuery({
    queryKey: queryKeys.branches,
    queryFn: async () => {
      const { supabase } = await import('@/lib/supabase/client')
      const { data: rows, error: branchError } = await supabase
        .from('branches')
        .select('id, name')
        .is('deleted_at', null)
        .eq('is_active', true)
        .order('name')
      if (branchError) throw branchError
      return rows ?? []
    },
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.organization_id) throw new Error('No organization')
      const payload: EmployeeInput = {
        employee_code: form.employee_code,
        full_name: form.full_name,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        branch_id: form.branch_id || null,
        department: form.department.trim() || null,
        designation: form.designation.trim() || null,
        basic_salary: Number(form.basic_salary) || 0,
        status: form.status,
      }
      if (!payload.employee_code.trim()) throw new Error('Employee code is required')
      if (!payload.full_name.trim()) throw new Error('Full name is required')
      if (editing) return updateEmployee(editing.id, payload)
      return createEmployee(profile.organization_id, payload)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['employees'] })
      toast(editing ? 'Employee updated' : 'Employee created')
      setOpen(false)
      setEditing(null)
      setForm(empty)
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  const deleteMutation = useMutation({
    mutationFn: softDeleteEmployee,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['employees'] })
      toast('Employee removed')
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  function openCreate() {
    setEditing(null)
    setForm(empty)
    setOpen(true)
  }

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-[#111111]">Employees</h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            HR directory · branch assignment · device user IDs from attendance mappings
          </p>
        </div>
        <PermissionGate permission="hr.employee.create">
          <Button className="rounded-full" asChild>
            <Link to="/hr/employees/new">
              <Plus className="mr-2 h-4 w-4" />
              Add employee
            </Link>
          </Button>
        </PermissionGate>
      </div>

      {stats ? (
        <KpiGrid
          items={[
            { label: 'Total employees', value: String(stats.total) },
            { label: 'Active', value: String(stats.active) },
            { label: 'With device ID', value: String(stats.with_device_id) },
          ]}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          placeholder="Search name, code, department…"
          className="max-w-sm"
        />
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value)
            setPage(1)
          }}
        >
          <SelectTrigger className="h-11 w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="terminated">Terminated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <p className="text-sm text-[#E11D48]">
          {error instanceof Error ? error.message : 'Failed to load employees'}
        </p>
      ) : null}

      {isLoading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-[#6B7280]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading employees…
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No employees yet"
          description="Add staff records to manage attendance, leave and payroll."
          actionLabel="Add employee"
          onAction={openCreate}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Device IDs</TableHead>
                <TableHead>Salary</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/hr/employees/${row.id}`)}
                >
                  <TableCell className="font-mono text-xs">{row.employee_code}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-[#E11D48]">{row.full_name}</p>
                      {row.phone ? <p className="text-xs text-[#6B7280]">{row.phone}</p> : null}
                    </div>
                  </TableCell>
                  <TableCell>{row.branch_name ?? '—'}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <p>{row.designation ?? '—'}</p>
                      {row.department ? (
                        <p className="text-xs text-[#6B7280]">{row.department}</p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    {row.device_user_ids.length > 0 ? (
                      <span className="text-xs text-[#6B7280]">
                        {row.device_user_ids.join(', ')}
                      </span>
                    ) : (
                      <span className="text-xs text-[#9CA3AF]">Not mapped</span>
                    )}
                  </TableCell>
                  <TableCell>{formatBDT(row.basic_salary)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[row.status as keyof typeof statusVariant] ?? 'default'}>
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <PermissionGate permission="hr.employee.update">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/hr/employees/${row.id}`)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </PermissionGate>
                      <PermissionGate permission="hr.employee.update">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (window.confirm(`Remove ${row.full_name}?`)) {
                              deleteMutation.mutate(row.id)
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-[#E11D48]" />
                        </Button>
                      </PermissionGate>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-[#6B7280]">
          <span>
            Page {page} of {totalPages} · {total} employees
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit employee' : 'Add employee'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="employee_code">Employee code</Label>
              <Input
                id="employee_code"
                value={form.employee_code}
                onChange={(e) => setForm((f) => ({ ...f, employee_code: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input
                id="full_name"
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Branch</Label>
              <Select
                value={form.branch_id || 'none'}
                onValueChange={(value) =>
                  setForm((f) => ({ ...f, branch_id: value === 'none' ? '' : value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No branch</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={form.department}
                onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="designation">Designation</Label>
              <Input
                id="designation"
                value={form.designation}
                onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="basic_salary">Basic salary</Label>
              <Input
                id="basic_salary"
                type="number"
                min="0"
                value={form.basic_salary}
                onChange={(e) => setForm((f) => ({ ...f, basic_salary: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) =>
                  setForm((f) => ({ ...f, status: value as FormState['status'] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
