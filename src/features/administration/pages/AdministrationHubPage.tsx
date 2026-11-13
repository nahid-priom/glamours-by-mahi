import { Link } from 'react-router-dom'
import { Shield, Users, KeyRound, Activity, Database, Target } from 'lucide-react'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import type { Permission } from '@/lib/permissions/catalog'

const tiles: Array<{
  to: string
  title: string
  description: string
  icon: typeof Users
  permission: Permission | Permission[]
}> = [
  {
    to: '/administration/users',
    title: 'Users',
    description: 'Staff accounts, invites, and branch access',
    icon: Users,
    permission: 'administration.users.read',
  },
  {
    to: '/administration/targets',
    title: 'Staff Targets',
    description: 'Daily, weekly and monthly sales targets',
    icon: Target,
    permission: ['staff.targets.manage', 'settings.manage'],
  },
  {
    to: '/administration/roles',
    title: 'Roles',
    description: 'Role templates and permission bundles',
    icon: Shield,
    permission: 'administration.roles.manage' as const,
  },
  {
    to: '/administration/permissions',
    title: 'Permissions',
    description: 'Catalog of enforced permission keys',
    icon: KeyRound,
    permission: 'administration.permissions.read' as const,
  },
  {
    to: '/administration/activity',
    title: 'Activity',
    description: 'Org-wide audit and activity feed',
    icon: Activity,
    permission: ['administration.activity.read', 'audit.read'],
  },
  {
    to: '/settings/data-reset',
    title: 'Data reset',
    description: 'Preview and execute destructive org reset',
    icon: Database,
    permission: 'settings.data_reset' as const,
  },
]

export function AdministrationHubPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#111827]">Administration</h1>
        <p className="text-sm text-[#6B7280]">Users, roles, permissions, and destructive maintenance.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {tiles.map((tile) => (
          <PermissionGate key={tile.to} permission={tile.permission}>
            <Link
              to={tile.to}
              className="flex gap-3 rounded-xl border border-border bg-white p-4 transition hover:shadow-md"
            >
              <tile.icon className="h-5 w-5 shrink-0 text-[#6B7280]" />
              <span>
                <span className="block font-semibold text-[#111827]">{tile.title}</span>
                <span className="text-sm text-[#6B7280]">{tile.description}</span>
              </span>
            </Link>
          </PermissionGate>
        ))}
      </div>
    </div>
  )
}
