import type { RouteObject } from 'react-router-dom'
import { PermissionRoute } from '@/app/guards/PermissionRoute'
import {
  ActivityLogsPage,
  AdminPermissionsPage,
  AdminRolesPage,
  AdministrationHubPage,
  AdminUserDetailPage,
  AdminUserInvitePage,
  AdminUsersListPage,
  AdminTargetsPage,
  withSuspense,
} from '@/app/routes/lazy'

export const administrationRoutes: RouteObject = {
  element: (
    <PermissionRoute
      permission={['administration.read', 'administration.users.read', 'settings.manage']}
    />
  ),
  children: [
    { path: '/administration', element: withSuspense(AdministrationHubPage) },
    {
      element: (
        <PermissionRoute
          permission={['administration.users.create', 'settings.manage']}
        />
      ),
      children: [
        { path: '/administration/users/new', element: withSuspense(AdminUserInvitePage) },
      ],
    },
    {
      element: (
        <PermissionRoute permission={['administration.users.read', 'settings.manage']} />
      ),
      children: [
        { path: '/administration/users', element: withSuspense(AdminUsersListPage) },
        { path: '/administration/users/:id', element: withSuspense(AdminUserDetailPage) },
      ],
    },
    {
      element: (
        <PermissionRoute permission={['administration.roles.manage', 'settings.manage']} />
      ),
      children: [{ path: '/administration/roles', element: withSuspense(AdminRolesPage) }],
    },
    {
      element: (
        <PermissionRoute permission={['administration.permissions.read', 'settings.manage']} />
      ),
      children: [{ path: '/administration/permissions', element: withSuspense(AdminPermissionsPage) }],
    },
    {
      element: (
        <PermissionRoute permission={['administration.activity.read', 'audit.read']} />
      ),
      children: [{ path: '/administration/activity', element: withSuspense(ActivityLogsPage) }],
    },
    {
      element: (
        <PermissionRoute permission={['staff.targets.manage', 'settings.manage']} />
      ),
      children: [{ path: '/administration/targets', element: withSuspense(AdminTargetsPage) }],
    },
  ],
}
