/**
 * Canonical attendance payload — shared contract for mobile + Edge + tests.
 * Stable JSON: alphabetically sorted keys, UTF-8, SHA-256 hex digest.
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

export async function sha256Hex(message: string): Promise<string> {
  const data = new TextEncoder().encode(message)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function hashCanonicalPayload(p: AttendanceCanonicalPayload): Promise<string> {
  return sha256Hex(canonicalizeAttendancePayload(p))
}

/** Test vector fixture — keep in sync across mobile/edge/vitest */
export const CANONICAL_TEST_VECTOR: AttendanceCanonicalPayload = {
  version: 1,
  accuracy: 12.5,
  app_version: '1.0.0',
  attendance_date: '2026-07-30',
  attendance_location_id: '11111111-1111-1111-1111-111111111111',
  auth_user_id: '22222222-2222-2222-2222-222222222222',
  branch_id: '33333333-3333-3333-3333-333333333333',
  challenge_id: '44444444-4444-4444-4444-444444444444',
  challenge_nonce: 'abc123nonce',
  device_id: '55555555-5555-5555-5555-555555555555',
  employee_id: '66666666-6666-6666-6666-666666666666',
  event_type: 'check_in',
  idempotency_key: '77777777-7777-7777-7777-777777777777',
  integrity_nonce: 'integnonce01',
  latitude: 23.78,
  location_captured_at: '2026-07-30T04:00:00.000Z',
  longitude: 90.41,
  organization_id: '88888888-8888-8888-8888-888888888888',
  platform: 'android',
  qr_token_hash: null,
  shift_id: '99999999-9999-9999-9999-999999999999',
}
