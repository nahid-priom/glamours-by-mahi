import type { RouteObject } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import { PermissionRoute } from '@/app/guards/PermissionRoute'
import {
  HrAttendancePage,
  HrEmployeesPage,
  HrLeavesPage,
  HrPayrollAdvancesPage,
  HrPayrollNewPage,
  HrPayrollPage,
  HrPayrollReportsPage,
  HrPayrollRunDetailPage,
  HrPayslipPage,
  HrSalaryStructuresPage,
  SalesCommissionsPage,
  CommissionSettingsPage,
  withSuspense,
} from './lazy'

export const hrRoutes: RouteObject = {
  element: <PermissionRoute module="hr" />,
  children: [
    { path: '/hr', element: <Navigate to="/hr/employees" replace /> },
    { path: '/hr/employees', element: withSuspense(HrEmployeesPage) },
    { path: '/hr/employees/new', element: withSuspense(HrEmployeesPage) },
    { path: '/hr/employees/:id', element: withSuspense(HrEmployeesPage) },
    { path: '/hr/attendance', element: withSuspense(HrAttendancePage) },
    { path: '/hr/leaves', element: withSuspense(HrLeavesPage) },
    { path: '/hr/payroll/salary-structures', element: withSuspense(HrSalaryStructuresPage) },
    { path: '/hr/payroll/advances', element: withSuspense(HrPayrollAdvancesPage) },
    { path: '/hr/payroll/reports', element: withSuspense(HrPayrollReportsPage) },
    { path: '/hr/payroll/new', element: withSuspense(HrPayrollNewPage) },
    { path: '/hr/payroll/:id/review', element: withSuspense(HrPayrollRunDetailPage) },
    { path: '/hr/payroll/:id/payments', element: withSuspense(HrPayrollRunDetailPage) },
    { path: '/hr/payroll/:id', element: withSuspense(HrPayrollRunDetailPage) },
    { path: '/hr/payslips/:payrollItemId', element: withSuspense(HrPayslipPage) },
    { path: '/hr/payroll', element: withSuspense(HrPayrollPage) },
    {
      element: <PermissionRoute permission="sales.commission.read" />,
      children: [{ path: '/hr/commissions', element: withSuspense(SalesCommissionsPage) }],
    },
    {
      element: <PermissionRoute permission="sales.commission.manage" />,
      children: [{ path: '/hr/commission-settings', element: withSuspense(CommissionSettingsPage) }],
    },
  ],
}
