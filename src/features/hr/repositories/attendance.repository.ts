import { supabase } from '@/lib/supabase/client'
import type { Tables } from '@/types/database'

export type AttendanceRecord = Tables<'attendance_records'>
export type AttendanceDevice = Tables<'attendance_devices'>

export type AttendanceListItem = AttendanceRecord & {
  employee_name: string
  employee_code: string
  branch_name: string | null
}

export type AttendanceFilters = {
  workDate?: string
  branchId?: string | null
  status?: string | null
  search?: string
  page?: number
  pageSize?: number
}

export type AttendanceStats = {
  present: number
  absent: number
  late: number
  leave: number
  half_day: number
  total: number
}

function range(page: number, pageSize: number) {
  const from = (page - 1) * pageSize
  return { from, to: from + pageSize - 1 }
}

type AttendanceRow = AttendanceRecord & {
  employees: { full_name: string; employee_code: string } | null
  branches: { name: string } | null
}

function mapRow(row: AttendanceRow): AttendanceListItem {
  return {
    ...row,
    employee_name: row.employees?.full_name ?? '—',
    employee_code: row.employees?.employee_code ?? '—',
    branch_name: row.branches?.name ?? null,
  }
}

export async function listAttendanceRecords(
  filters: AttendanceFilters = {},
): Promise<{ items: AttendanceListItem[]; total: number }> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 50
  const { from, to } = range(page, pageSize)
  const workDate = filters.workDate ?? new Date().toISOString().slice(0, 10)

  let builder = supabase
    .from('attendance_records')
    .select('*, employees(full_name, employee_code), branches(name)', { count: 'exact' })
    .is('deleted_at', null)
    .eq('work_date', workDate)
    .order('first_in', { ascending: false, nullsFirst: false })
    .range(from, to)

  if (filters.branchId) builder = builder.eq('branch_id', filters.branchId)
  if (filters.status) builder = builder.eq('status', filters.status)

  const { data, error, count } = await builder
  if (error) throw error

  let items = (data ?? []).map((row) => mapRow(row as AttendanceRow))

  const q = filters.search?.trim().toLowerCase()
  if (q) {
    items = items.filter(
      (r) =>
        r.employee_name.toLowerCase().includes(q) ||
        r.employee_code.toLowerCase().includes(q),
    )
  }

  return { items, total: q ? items.length : (count ?? 0) }
}

export async function getAttendanceStats(
  workDate?: string,
  branchId?: string | null,
): Promise<AttendanceStats> {
  const date = workDate ?? new Date().toISOString().slice(0, 10)

  let builder = supabase
    .from('attendance_records')
    .select('status, late_minutes')
    .is('deleted_at', null)
    .eq('work_date', date)

  if (branchId) builder = builder.eq('branch_id', branchId)

  const { data, error } = await builder
  if (error) throw error

  const rows = data ?? []
  const stats: AttendanceStats = {
    present: 0,
    absent: 0,
    late: 0,
    leave: 0,
    half_day: 0,
    total: rows.length,
  }

  for (const row of rows) {
    if (row.status === 'present') stats.present++
    else if (row.status === 'absent') stats.absent++
    else if (row.status === 'leave') stats.leave++
    else if (row.status === 'half_day') stats.half_day++
    if (Number(row.late_minutes) > 0) stats.late++
  }

  return stats
}

export async function listAttendanceDevices(): Promise<AttendanceDevice[]> {
  const { data, error } = await supabase
    .from('attendance_devices')
    .select('*')
    .is('deleted_at', null)
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function getTodayAttendanceSummary(branchId?: string | null) {
  const today = new Date().toISOString().slice(0, 10)
  const stats = await getAttendanceStats(today, branchId)

  let builder = supabase
    .from('attendance_records')
    .select('*, employees(full_name, designation)')
    .is('deleted_at', null)
    .eq('work_date', today)
    .order('first_in', { ascending: true, nullsFirst: false })
    .limit(12)

  if (branchId) builder = builder.eq('branch_id', branchId)

  const { data, error } = await builder
  if (error) throw error

  const employees = (data ?? []).map((row) => {
    const emp = row.employees as { full_name: string; designation: string | null } | null
    const checkIn = row.first_in
      ? new Date(row.first_in).toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' })
      : '—'
    return {
      id: row.employee_id,
      name: emp?.full_name ?? '—',
      role: emp?.designation ?? '—',
      status: row.status,
      checkIn,
    }
  })

  return {
    present: stats.present + stats.half_day,
    late: stats.late,
    absent: stats.absent,
    leave: stats.leave,
    employees,
  }
}

type UntypedRpc = (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>

const untypedRpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc
// New mobile tables are not yet in generated Database types
const fromUntyped = (table: string) => (supabase as unknown as { from: (t: string) => any }).from(table)

export type MobileDeviceRow = {
  id: string
  employee_id: string
  status: string
  platform: string
  device_name: string | null
  installation_id: string
  created_at: string
  employees: { full_name: string; employee_code: string } | null
}

export async function listMobileAttendanceDevices(): Promise<MobileDeviceRow[]> {
  const { data, error } = await fromUntyped('employee_attendance_devices')
    .select('id, employee_id, status, platform, device_name, installation_id, created_at, employees(full_name, employee_code)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as MobileDeviceRow[]
}

export async function approveMobileDevice(payload: {
  device_id: string
  action: 'approve' | 'reject' | 'revoke' | 'block'
  reason?: string
}) {
  const { data, error } = await untypedRpc('approve_attendance_device', { payload })
  if (error) throw new Error(error.message)
  return data
}

export type AttendanceAttemptRow = {
  id: string
  employee_id: string | null
  event_type: string | null
  decision: string
  rejection_reason: string | null
  risk_score: number
  distance_metres: number | null
  created_at: string
}

export async function listAttendanceAttempts(limit = 50): Promise<AttendanceAttemptRow[]> {
  const { data, error } = await fromUntyped('attendance_attempts')
    .select(
      'id, employee_id, event_type, decision, rejection_reason, risk_score, distance_metres, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as AttendanceAttemptRow[]
}

export type CorrectionRequestRow = {
  id: string
  employee_id: string
  work_date: string
  request_type: string
  reason: string
  status: string
  created_at: string
  employees: { full_name: string; employee_code: string } | null
}

export async function listCorrectionRequests(): Promise<CorrectionRequestRow[]> {
  const { data, error } = await fromUntyped('attendance_correction_requests')
    .select(
      'id, employee_id, work_date, request_type, reason, status, created_at, employees(full_name, employee_code)',
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return (data ?? []) as CorrectionRequestRow[]
}

export async function reviewCorrectionRequest(payload: {
  id: string
  action: 'approve' | 'reject'
  notes?: string
}) {
  const { data, error } = await untypedRpc('review_attendance_correction', { payload })
  if (error) throw new Error(error.message)
  return data
}

export async function issueBranchQr(branchId: string) {
  const { data, error } = await untypedRpc('issue_attendance_branch_qr', {
    payload: { branch_id: branchId },
  })
  if (error) throw new Error(error.message)
  return data as {
    id: string
    branch_id: string
    token: string
    issued_at: string
    expires_at: string
  }
}
