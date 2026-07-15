/**
 * Compatibility shim around Supabase auth session for legacy page shapes.
 */
export {
  AuthSessionProvider as AuthProvider,
  AuthSessionProvider,
  useAuth as useSupabaseAuth,
} from './auth-session'
export type { AuthProfile } from './auth-session'

import { useAuth as useSessionAuth } from './auth-session'

export type ErpRoleName =
  | 'Owner'
  | 'Super Admin'
  | 'Branch Admin'
  | 'Accounts'
  | 'Salesperson'
  | 'HR'
  | 'Staff'

export interface DemoSession {
  userId: string
  role: ErpRoleName
  name: string
  branchId: string | null
}

const GUEST_SESSION: DemoSession = {
  userId: '',
  role: 'Salesperson',
  name: 'Staff',
  branchId: null,
}

export function useAuth() {
  const auth = useSessionAuth()

  const session: DemoSession = auth.profile
    ? {
        userId: auth.profile.id,
        role: (auth.profile.role_name as ErpRoleName) || 'Salesperson',
        name: auth.profile.full_name,
        branchId: auth.activeBranchId,
      }
    : GUEST_SESSION

  return {
    ...auth,
    session,
    users: [] as { id: string; name: string; role: string }[],
    switchUser: async (_userId: string) => {
      /* Role switch removed — use real user accounts in Supabase Auth */
    },
    canAccess: (module: string) => auth.permissions.includes('*') || auth.can(module as never),
    role: session.role,
  }
}
