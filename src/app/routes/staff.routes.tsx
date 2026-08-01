import type { RouteObject } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import { PermissionRoute } from '@/app/guards/PermissionRoute'
import {
  StaffDashboardPage,
  StaffFollowUpsPage,
  StaffMyCommissionPage,
  StaffMyCustomersPage,
  StaffMyOrdersPage,
  StaffMySalesPage,
  StaffMyTargetsPage,
  StaffProfilePage,
  withSuspense,
} from '@/app/routes/lazy'

export const staffRoutes: RouteObject = {
  element: (
    <PermissionRoute
      permission={[
        'staff.dashboard.read',
        'moderator.dashboard.read',
        'staff.sales.read_own',
        'sales.read',
      ]}
    />
  ),
  children: [
    { path: '/staff', element: <Navigate to="/staff/dashboard" replace /> },
    { path: '/staff/dashboard', element: withSuspense(StaffDashboardPage) },
    { path: '/staff/my-sales', element: withSuspense(StaffMySalesPage) },
    { path: '/staff/my-orders', element: withSuspense(StaffMyOrdersPage) },
    { path: '/staff/my-commission', element: withSuspense(StaffMyCommissionPage) },
    { path: '/staff/my-targets', element: withSuspense(StaffMyTargetsPage) },
    { path: '/staff/my-customers', element: withSuspense(StaffMyCustomersPage) },
    { path: '/staff/follow-ups', element: withSuspense(StaffFollowUpsPage) },
    { path: '/staff/profile', element: withSuspense(StaffProfilePage) },
  ],
}
