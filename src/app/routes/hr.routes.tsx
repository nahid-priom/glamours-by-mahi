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

export const hrRoutes: RouteObject[] = [
  { path: '/hr', element: <Navigate to="/hr/employees" replace /> },
  {
    element: <PermissionRoute permission={['hr.read', 'hr.employee.create', 'hr.employee.update']} />,
    children: [
      { path: '/hr/employees', element: withSuspense(HrEmployeesPage) },
      { path: '/hr/employees/new', element: withSuspense(HrEmployeesPage) },
      { path: '/hr/employees/:id', element: withSuspense(HrEmployeesPage) },
    ],
  },
  {
    element: (
      <PermissionRoute
        permission={['hr.attendance.read', 'hr.attendance.manage', 'hr.attendance.self.read']}
      />
    ),
    children: [{ path: '/hr/attendance', element: withSuspense(HrAttendancePage) }],
  },
  {
    element: <PermissionRoute permission={['hr.leave.read', 'hr.leave.approve']} />,
    children: [{ path: '/hr/leaves', element: withSuspense(HrLeavesPage) }],
  },
  {
    element: (
      <PermissionRoute
        permission={[
          'hr.payroll.read',
          'hr.payroll.create',
          'hr.payroll.calculate',
          'hr.payroll.review',
          'hr.payroll.approve',
          'hr.payroll.pay',
        ]}
      />
    ),
    children: [
      { path: '/hr/payroll/salary-structures', element: withSuspense(HrSalaryStructuresPage) },
      { path: '/hr/payroll/advances', element: withSuspense(HrPayrollAdvancesPage) },
      { path: '/hr/payroll/reports', element: withSuspense(HrPayrollReportsPage) },
      { path: '/hr/payroll/new', element: withSuspense(HrPayrollNewPage) },
      { path: '/hr/payroll/:id/review', element: withSuspense(HrPayrollRunDetailPage) },
      { path: '/hr/payroll/:id/payments', element: withSuspense(HrPayrollRunDetailPage) },
      { path: '/hr/payroll/:id', element: withSuspense(HrPayrollRunDetailPage) },
      { path: '/hr/payslips/:payrollItemId', element: withSuspense(HrPayslipPage) },
      { path: '/hr/payroll', element: withSuspense(HrPayrollPage) },
    ],
  },
  {
    element: <PermissionRoute permission="sales.commission.read" />,
    children: [{ path: '/hr/commissions', element: withSuspense(SalesCommissionsPage) }],
  },
  {
    element: <PermissionRoute permission="sales.commission.manage" />,
    children: [{ path: '/hr/commission-settings', element: withSuspense(CommissionSettingsPage) }],
  },
]
