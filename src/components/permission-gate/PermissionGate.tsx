import type { ReactNode } from 'react'
import { useAuth } from '@/features/auth/auth-session'
import type { Permission } from '@/lib/permissions'

interface PermissionGateProps {
  permission: Permission | Permission[]
  children: ReactNode
  fallback?: ReactNode
}

/** Hide UI actions the user cannot perform. Always pair with RPC/RLS. */
export function PermissionGate({ permission, children, fallback = null }: PermissionGateProps) {
  const { can } = useAuth()
  if (!can(permission)) return <>{fallback}</>
  return <>{children}</>
}
