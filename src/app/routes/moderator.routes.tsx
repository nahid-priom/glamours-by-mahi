import type { RouteObject } from 'react-router-dom'
import { PermissionRoute } from '@/app/guards/PermissionRoute'
import { ModeratorDashboardPage, ModeratorOrderWorkspacePage, withSuspense } from './lazy'

export const moderatorRoutes: RouteObject = {
  element: (
    <PermissionRoute
      permission={[
        'moderator.dashboard.read',
        'moderator.order.create',
        'moderator.order.read_own',
      ]}
    />
  ),
  children: [
    {
      element: <PermissionRoute permission="moderator.dashboard.read" />,
      children: [{ path: '/moderator', element: withSuspense(ModeratorDashboardPage) }],
    },
    {
      element: <PermissionRoute permission="moderator.order.create" />,
      children: [
        { path: '/moderator/orders/new', element: withSuspense(ModeratorOrderWorkspacePage) },
      ],
    },
  ],
}
