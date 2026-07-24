import { supabase } from '@/lib/supabase/client'
import type { Tables, TablesInsert } from '@/types/database'

export type LeaveRequest = Tables<'leave_requests'>

export type LeaveListItem = LeaveRequest & {
  employee_name: string
  employee_code: string
}

export type LeaveFilters = {
  status?: string | null
  search?: string
  page?: number
  pageSize?: number
}

export type LeaveStats = {
  pending: number
  approved: number
  rejected: number
  cancelled: number
  total: number
}

export type LeaveInput = {
  employee_id: string
  leave_type: string
  start_date: string
  end_date: string
  days?: number
  reason?: string | null
}

function range(page: number, pageSize: number) {
  const from = (page - 1) * pageSize
  return { from, to: from + pageSize - 1 }
}

type LeaveRow = LeaveRequest & {
  employees: { full_name: string; employee_code: string } | null
}

function mapRow(row: LeaveRow): LeaveListItem {
  return {
    ...row,
    employee_name: row.employees?.full_name ?? '—',
    employee_code: row.employees?.employee_code ?? '—',
  }
}

export async function listLeaveRequests(
  filters: LeaveFilters = {},
): Promise<{ items: LeaveListItem[]; total: number }> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 50
  const { from, to } = range(page, pageSize)

  let builder = supabase
    .from('leave_requests')
    .select('*, employees(full_name, employee_code)', { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters.status) builder = builder.eq('status', filters.status)

  const { data, error, count } = await builder
  if (error) throw error

  let items = (data ?? []).map((row) => mapRow(row as LeaveRow))

  const q = filters.search?.trim().toLowerCase()
  if (q) {
    items = items.filter(
      (r) =>
        r.employee_name.toLowerCase().includes(q) ||
        r.employee_code.toLowerCase().includes(q) ||
        r.leave_type.toLowerCase().includes(q),
    )
  }

  return { items, total: q ? items.length : (count ?? 0) }
}

export async function getLeaveStats(): Promise<LeaveStats> {
  const { data, error } = await supabase
    .from('leave_requests')
    .select('status')
    .is('deleted_at', null)

  if (error) throw error

  const rows = data ?? []
  return {
    pending: rows.filter((r) => r.status === 'pending').length,
    approved: rows.filter((r) => r.status === 'approved').length,
    rejected: rows.filter((r) => r.status === 'rejected').length,
    cancelled: rows.filter((r) => r.status === 'cancelled').length,
    total: rows.length,
  }
}

export async function createLeaveRequest(
  organizationId: string,
  input: LeaveInput,
): Promise<LeaveRequest> {
  const payload = {
    organization_id: organizationId,
    employee_id: input.employee_id,
    leave_type: input.leave_type,
    start_date: input.start_date,
    end_date: input.end_date,
    days: input.days ?? 1,
    reason: input.reason?.trim() || null,
    status: 'pending',
  } as TablesInsert<'leave_requests'>

  const { data, error } = await supabase.from('leave_requests').insert(payload).select('*').single()
  if (error) throw error
  return data
}

export async function updateLeaveStatus(
  id: string,
  status: 'approved' | 'rejected' | 'cancelled',
): Promise<LeaveRequest> {
  const { data, error } = await supabase
    .from('leave_requests')
    .update({
      status,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}
