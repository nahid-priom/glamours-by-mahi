/**
 * @deprecated Dead demo guard — router uses `@/app/guards/AdminAuthGuard` (Supabase session).
 * Kept only to avoid accidental imports from old paths; do not use.
 */
import { Navigate } from 'react-router-dom'

export function AdminAuthGuard() {
  return <Navigate to="/admin/login" replace />
}
