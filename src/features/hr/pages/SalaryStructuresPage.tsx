import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Plus } from 'lucide-react'
import { AppDateField } from '@/components/date-picker'
import { Button } from '@/components/ui/button'
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
import { EmptyState } from '@/components/shared/EmptyState'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { useToast } from '@/components/ui/toast'
import { formatBDT } from '@/lib/format'
import { queryKeys } from '@/lib/query/keys'
import { listEmployees } from '../repositories/employees.repository'
import { listSalaryStructures, saveSalaryStructure } from '../repositories/payroll.repository'
import { toastRpcError } from '@/lib/errors/rpc-error'

export function SalaryStructuresPage() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [showForm, setShowForm] = useState(false)
  const [employeeId, setEmployeeId] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10))
  const [salaryType, setSalaryType] = useState<'monthly' | 'daily' | 'hourly'>('monthly')
  const [basicSalary, setBasicSalary] = useState('')

  const { data: structures = [], isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.salaryStructures,
    queryFn: listSalaryStructures,
  })

  const { data: employeesData } = useQuery({
    queryKey: queryKeys.employees({ status: 'active', pageSize: 500 }),
    queryFn: () => listEmployees({ status: 'active', pageSize: 500 }),
  })

  const employees = employeesData?.items ?? []

  const save = useMutation({
    mutationFn: () =>
      saveSalaryStructure({
        employee_id: employeeId,
        effective_from: effectiveFrom,
        salary_type: salaryType,
        basic_salary: Number(basicSalary),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.salaryStructures })
      toast('Salary structure saved')
      setShowForm(false)
      setEmployeeId('')
      setBasicSalary('')
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link to="/hr/payroll">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Payroll
            </Link>
          </Button>
          <h1 className="font-serif text-3xl text-[#111111]">Salary structures</h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Effective-dated salary packages used when calculating payroll
          </p>
        </div>
        <PermissionGate permission="hr.salary_structure.manage">
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add structure
          </Button>
        </PermissionGate>
      </div>

      {showForm ? (
        <div className="rounded-2xl border bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label>Employee</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger className="mt-1 h-10">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.full_name} ({e.employee_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Effective from</Label>
              <AppDateField className="mt-1" value={effectiveFrom} onChange={setEffectiveFrom} />
            </div>
            <div>
              <Label>Salary type</Label>
              <Select value={salaryType} onValueChange={(v) => setSalaryType(v as typeof salaryType)}>
                <SelectTrigger className="mt-1 h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Basic salary</Label>
              <input
                type="number"
                min="0"
                className="mt-1 h-10 w-full rounded-lg border px-2 text-sm"
                value={basicSalary}
                onChange={(e) => setBasicSalary(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              disabled={!employeeId || !basicSalary || save.isPending}
              onClick={() => save.mutate()}
            >
              Save structure
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <EmptyState
          title="Could not load salary structures"
          description={error instanceof Error ? error.message : 'Please try again.'}
          actionLabel="Retry"
          onAction={() => refetch()}
        />
      ) : isLoading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-[#6B7280]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : structures.length === 0 ? (
        <EmptyState
          title="No salary structures"
          description="Add an effective-dated structure for each employee."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Effective from</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Basic</TableHead>
                <TableHead>Components</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {structures.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{row.employees?.full_name ?? '—'}</p>
                      <p className="text-xs text-[#6B7280]">{row.employees?.employee_code}</p>
                    </div>
                  </TableCell>
                  <TableCell>{row.effective_from}</TableCell>
                  <TableCell className="capitalize">{row.salary_type}</TableCell>
                  <TableCell>{formatBDT(row.basic_salary)}</TableCell>
                  <TableCell className="text-xs">
                    {row.salary_structure_components.length === 0
                      ? '—'
                      : row.salary_structure_components
                          .map((c) => `${c.name}: ${formatBDT(c.amount)}`)
                          .join(' · ')}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs">{row.notes ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
