import { ModulePlaceholder } from '@/features/common/ModulePlaceholder'

export { EmployeesPage as HrEmployeesPage } from './pages/EmployeesPage'

/** HR module — attendance, leave and payroll UIs connect next. */
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
