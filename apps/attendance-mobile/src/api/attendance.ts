import { functionsBaseUrl, supabase } from '../lib/supabase'
import * as Crypto from 'expo-crypto'

async function authHeaders() {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Session expired — please login again')
  return {
    Authorization: `Bearer ${token}`,
    apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    'Content-Type': 'application/json',
  }
}

async function invokeFunction(name: string, body: Record<string, unknown>) {
  const res = await fetch(`${functionsBaseUrl()}/${name}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Request failed')
  return json
}

export type MobileContext = {
  server_now: string
  work_date: string
  employee: {
    id: string
    employee_code: string
    full_name: string
    branch_id: string | null
    status: string
  }
  shift: {
    id: string
    name: string
    start_time: string
    end_time: string
    timezone: string
  } | null
  device: {
    id: string
    status: string
    platform: string
    device_name: string | null
  } | null
  today: {
    id: string
    status: string
    first_in: string | null
    last_out: string | null
    late_minutes: number
    is_approved: boolean
  } | null
  location: {
    id: string
    name: string
    allowed_radius_metres: number
    requires_qr: boolean
  } | null
}

export async function getContext(): Promise<MobileContext> {
  const { data, error } = await supabase.rpc('get_mobile_attendance_context')
  if (error) throw new Error(error.message)
  return data as MobileContext
}

export async function registerDevice(payload: Record<string, unknown>) {
  return invokeFunction('attendance-device-register', payload)
}

export async function createChallenge(deviceId: string, eventType: 'check_in' | 'check_out') {
  return invokeFunction('attendance-challenge', {
    device_id: deviceId,
    event_type: eventType,
  }) as Promise<{
    challenge_id: string
    nonce: string
    integrity_nonce: string
    expires_at: string
    event_type: string
    employee_id: string
    organization_id: string
    branch_id: string | null
    shift_id: string | null
    attendance_location_id: string | null
    attendance_date: string
    qr_required: boolean
  }>
}

export async function submitAttendance(payload: Record<string, unknown>) {
  return invokeFunction('attendance-submit', {
    ...payload,
    idempotency_key: payload.idempotency_key ?? Crypto.randomUUID(),
  })
}

export async function requestCorrection(payload: Record<string, unknown>) {
  return invokeFunction('attendance-correction-request', payload)
}

export async function listOwnHistory(limit = 31) {
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) throw new Error('Not authenticated')
  const { data: emp, error: empErr } = await supabase
    .from('employees')
    .select('id')
    .eq('profile_id', user.user.id)
    .eq('status', 'active')
    .is('deleted_at', null)
    .maybeSingle()
  if (empErr) throw new Error(empErr.message)
  if (!emp) return []
  const { data, error } = await supabase
    .from('attendance_records')
    .select('id, work_date, status, first_in, last_out, late_minutes, working_minutes, overtime_minutes')
    .eq('employee_id', emp.id)
    .is('deleted_at', null)
    .order('work_date', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return data ?? []
}
