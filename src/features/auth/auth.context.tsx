import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { authService, type DemoSession } from '@/services/auth.service'
import type { ErpRole } from '@/database/schema'

interface AuthContextValue {
  session: DemoSession
  users: ReturnType<typeof authService.getUsers>
  switchUser: (userId: string) => void
  logout: () => void
  canAccess: (module: string) => boolean
  role: ErpRole
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<DemoSession>(() => {
    const existing = authService.getSession()
    if (!existing) {
      // Guard should prevent this; fall back for safety during HMR
      return authService.ensureSession()
    }
    return existing
  })
  const users = useMemo(() => authService.getUsers(), [session.userId])

  const switchUser = useCallback((userId: string) => {
    setSession(authService.switchRole(userId))
  }, [])

  const logout = useCallback(() => {
    authService.logout()
    window.location.assign('/admin/login')
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      users,
      switchUser,
      logout,
      canAccess: (module: string) => authService.canAccess(session.role, module),
      role: session.role,
    }),
    [session, users, switchUser, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
