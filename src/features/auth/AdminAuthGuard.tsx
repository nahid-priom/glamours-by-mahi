import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { AuthProvider } from './auth.context'
import { authService } from '@/services/auth.service'

export function AdminAuthGuard() {
  const location = useLocation()
  const session = authService.getSession()

  if (!session) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  }

  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}
