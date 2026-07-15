import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { AuthSessionProvider, useAuth } from '@/features/auth/auth-session'
import { FullPageLoader } from '@/components/loading/FullPageLoader'

function GuardInner() {
  const { session, loading, profile } = useAuth()
  const location = useLocation()

  if (loading) {
    return <FullPageLoader label="Restoring session…" />
  }

  if (!session) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  }

  if (!profile) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm font-semibold text-[#111827]">Staff profile not found</p>
        <p className="max-w-md text-xs text-[#6B7280]">
          Your Auth user exists, but there is no active row in profiles. Apply supabase/migrations
          and seed a profile linked to your user id, then sign in again.
        </p>
      </div>
    )
  }

  if (!profile.is_active) {
    return <Navigate to="/admin/login" replace state={{ reason: 'inactive' }} />
  }

  return <Outlet />
}

/** Restores Supabase session before rendering protected admin routes. */
export function AdminAuthGuard() {
  return (
    <AuthSessionProvider>
      <GuardInner />
    </AuthSessionProvider>
  )
}
