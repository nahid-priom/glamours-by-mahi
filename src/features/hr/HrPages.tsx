import { ModulePlaceholder } from '@/features/common/ModulePlaceholder'

/** HR module — tables/permissions ready; connect UI to repositories next. */
export function HrEmployeesPage() {
  return (
    <ModulePlaceholder
      title="Employees"
      description="Employee records, device user IDs and branch assignment load from Supabase HR tables (migration 017)."
      permissionHint="hr.read / hr.employee.create"
    />
  )
}

export function HrAttendancePage() {
  return (
    <ModulePlaceholder
      title="Attendance"
      description="Device raw logs → daily attendance records → payroll. Adapters: ZKTeco, webhook, CSV, manual."
      permissionHint="hr.attendance.read / hr.device.manage"
    />
  )
}

export function HrLeavesPage() {
  return (
    <ModulePlaceholder
      title="Leave"
      description="Leave requests are stored in leave_requests with approve/reject workflow."
      permissionHint="hr.leave.read / hr.leave.approve"
    />
  )
}

export function HrPayrollPage() {
  return (
    <ModulePlaceholder
      title="Payroll"
      description="Payroll runs use attendance summaries (never raw punches). Approved payroll posts to Accounts."
      permissionHint="hr.payroll.read / hr.payroll.approve"
    />
  )
}
