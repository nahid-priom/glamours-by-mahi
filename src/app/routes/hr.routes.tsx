import type { RouteObject } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import { PermissionRoute } from '@/app/guards/PermissionRoute'
import {
  HrAttendancePage,
  HrEmployeesPage,
  HrLeavesPage,
  HrPayrollPage,
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
    { path: '/hr/payroll', element: withSuspense(HrPayrollPage) },
    { path: '/hr/payroll/:id', element: withSuspense(HrPayrollPage) },
  ],
}
