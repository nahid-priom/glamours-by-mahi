import { AppDateField } from '@/components/date-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type EmployeeFormState = {
  employee_code: string
  full_name: string
  phone: string
  email: string
  branch_id: string
  department: string
  designation: string
  basic_salary: string
  joining_date: string
  status: 'active' | 'inactive' | 'terminated'
  commission_eligible: boolean
  include_commission_in_payroll: boolean
  notes: string
}

export const emptyEmployeeForm: EmployeeFormState = {
  employee_code: '',
  full_name: '',
  phone: '',
  email: '',
  branch_id: '',
  department: '',
  designation: '',
  basic_salary: '0',
  joining_date: '',
  status: 'active',
  commission_eligible: false,
  include_commission_in_payroll: true,
  notes: '',
}

type Branch = { id: string; name: string }

export function EmployeeFormFields({
  form,
  setForm,
  branches,
}: {
  form: EmployeeFormState
  setForm: React.Dispatch<React.SetStateAction<EmployeeFormState>>
  branches: Branch[]
}) {
  return (
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
        <Label htmlFor="email">Email / login identifier</Label>
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
        <Label htmlFor="joining_date">Joining date</Label>
        <AppDateField
          id="joining_date"
          value={form.joining_date}
          onChange={(joining_date) => setForm((f) => ({ ...f, joining_date }))}
        />
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
            setForm((f) => ({ ...f, status: value as EmployeeFormState['status'] }))
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
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          checked={form.commission_eligible}
          onChange={(e) => setForm((f) => ({ ...f, commission_eligible: e.target.checked }))}
        />
        Commission eligible
      </label>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          checked={form.include_commission_in_payroll}
          onChange={(e) =>
            setForm((f) => ({ ...f, include_commission_in_payroll: e.target.checked }))
          }
        />
        Include approved commission in payroll (not direct pay)
      </label>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="notes">Notes</Label>
        <Input
          id="notes"
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        />
      </div>
    </div>
  )
}

export function formToEmployeeInput(form: EmployeeFormState) {
  return {
    employee_code: form.employee_code,
    full_name: form.full_name,
    phone: form.phone.trim() || null,
    email: form.email.trim() || null,
    branch_id: form.branch_id || null,
    department: form.department.trim() || null,
    designation: form.designation.trim() || null,
    basic_salary: Number(form.basic_salary) || 0,
    status: form.status,
    joining_date: form.joining_date || null,
    commission_eligible: form.commission_eligible,
    include_commission_in_payroll: form.include_commission_in_payroll,
    notes: form.notes.trim() || null,
  }
}
