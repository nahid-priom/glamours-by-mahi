/**
 * Detect Postgres unique_violation / PostgREST 409 Conflict from Supabase errors.
 */
export function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as {
    code?: string
    status?: number
    statusCode?: string | number
    message?: string
    details?: string
    hint?: string
  }
  if (e.code === '23505') return true
  if (e.status === 409 || e.statusCode === 409 || e.statusCode === '409') return true
  const blob = `${e.message ?? ''} ${e.details ?? ''} ${e.hint ?? ''}`
  return /duplicate key|unique constraint|already exists|409\s*\(Conflict\)/i.test(blob)
}
