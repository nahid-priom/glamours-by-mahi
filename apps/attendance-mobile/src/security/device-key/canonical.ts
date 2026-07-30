/**
 * Canonical attendance payload (mobile copy — keep in sync with shared/attendance-contracts).
 */

export type AttendanceCanonicalPayload = {
  accuracy: number
  app_version: string
  attendance_date: string
  attendance_location_id: string | null
  auth_user_id: string
  branch_id: string | null
  challenge_id: string
  challenge_nonce: string
  device_id: string
  employee_id: string
  event_type: 'check_in' | 'check_out'
  idempotency_key: string
  integrity_nonce: string
  latitude: number
  location_captured_at: string
  longitude: number
  organization_id: string
  platform: string
  qr_token_hash: string | null
  shift_id: string | null
  version: number
}

export function canonicalizeAttendancePayload(p: AttendanceCanonicalPayload): string {
  const keys = Object.keys(p).sort() as (keyof AttendanceCanonicalPayload)[]
  const obj: Record<string, unknown> = {}
  for (const k of keys) {
    const v = p[k]
    obj[k] = v === undefined ? null : v
  }
  return JSON.stringify(obj)
}
