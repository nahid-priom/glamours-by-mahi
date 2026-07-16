import type { RouteObject } from 'react-router-dom'
import { PermissionRoute } from '@/app/guards/PermissionRoute'
import { DashboardPage, withSuspense } from './lazy'

export const dashboardRoutes: RouteObject = {
  element: <PermissionRoute module="dashboard" />,
  children: [{ path: '/dashboard', element: withSuspense(DashboardPage) }],
}
