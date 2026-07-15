import { ModulePlaceholder } from '@/features/common/ModulePlaceholder'

/** HR module pages — schema/permissions ready; full UI lands in a later phase. */
export function HrEmployeesPage() {
  return (
    <ModulePlaceholder
      title="Employees"
      description="Employee records will load from Supabase HR tables. Use Settings → Roles for access control today."
      permissionHint="settings.manage"
    />
  )
}

export function HrAttendancePage() {
  return (
    <ModulePlaceholder
      title="Attendance"
      description="Daily attendance tracking will connect to Supabase. Payroll-related accounting stays in Accounts → Expenses."
      permissionHint="settings.manage"
    />
  )
}

export function HrLeavesPage() {
  return (
    <ModulePlaceholder
      title="Leave"
      description="Leave requests will be managed in Supabase once the HR tables are activated for this deployment."
      permissionHint="settings.manage"
    />
  )
}

export function HrPayrollPage() {
  return (
    <ModulePlaceholder
      title="Payroll"
      description="Payroll runs will post salary expenses through Simple Accounting. Full payroll UI is coming next."
      permissionHint="settings.manage"
    />
  )
}
