import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/features/auth/auth-session'
import { hasAnyModuleAccess, hasPermission, type Permission } from '@/lib/permissions'
import { FullPageLoader } from '@/components/loading/FullPageLoader'

interface PermissionRouteProps {
  module?: string
  permission?: Permission | Permission[]
  fallback?: string
}

/** Blocks direct URL access when the user lacks module/permission access. */
export function PermissionRoute({
  module,
  permission,
  fallback = '/dashboard',
}: PermissionRouteProps) {
  const { loading, permissions } = useAuth()

  if (loading) return <FullPageLoader label="Checking access…" />

  const allowed = permission
    ? hasPermission(permissions, permission)
    : module
      ? hasAnyModuleAccess(permissions, module)
      : true

  if (!allowed) {
    return <Navigate to={fallback} replace />
  }

  return <Outlet />
}
