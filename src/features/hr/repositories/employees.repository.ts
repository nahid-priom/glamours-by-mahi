import { supabase } from '@/lib/supabase/client'
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database'

type UntypedRpc = (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>

const untypedRpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc

export type Employee = Tables<'employees'>
export type EmployeeDeviceMapping = Tables<'employee_device_mappings'>

export type EmployeeListItem = Employee & {
  branch_name: string | null
  device_user_ids: string[]
}

export type EmployeeFilters = {
  search?: string
  status?: string | null
  branch_id?: string | null
  page?: number
  pageSize?: number
}

export type EmployeeInput = {
  employee_code: string
  full_name: string
  phone?: string | null
  email?: string | null
  branch_id?: string | null
  department?: string | null
  designation?: string | null
  shift_name?: string | null
  basic_salary?: number
  employment_type?: 'full_time' | 'part_time' | 'contract' | 'intern'
  salary_type?: 'monthly' | 'daily' | 'hourly'
  status?: 'active' | 'inactive' | 'terminated'
  profile_id?: string | null
  commission_eligible?: boolean
  commission_payment_mode?: 'payroll' | 'direct' | 'select_at_approval'
  include_commission_in_payroll?: boolean
  notes?: string | null
}

function range(page: number, pageSize: number) {
  const from = (page - 1) * pageSize
  return { from, to: from + pageSize - 1 }
}

type EmployeeRow = Employee & {
  branches: { name: string } | null
  employee_device_mappings: Array<{ device_user_id: string; is_active: boolean }> | null
}

function mapEmployee(row: EmployeeRow): EmployeeListItem {
  const device_user_ids = (row.employee_device_mappings ?? [])
    .filter((m) => m.is_active)
    .map((m) => m.device_user_id)

  return {
    ...row,
    branch_name: row.branches?.name ?? null,
    device_user_ids,
  }
}

export async function listEmployees(
  filters: EmployeeFilters = {},
): Promise<{ items: EmployeeListItem[]; total: number }> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 50
  const { from, to } = range(page, pageSize)
  const q = filters.search?.trim()

  let builder = supabase
    .from('employees')
    .select(
      '*, branches(name), employee_device_mappings(device_user_id, is_active)',
      { count: 'exact' },
    )
    .is('deleted_at', null)
    .order('full_name', { ascending: true })
    .range(from, to)

  if (q) {
    builder = builder.or(
      `full_name.ilike.%${q}%,employee_code.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,department.ilike.%${q}%,designation.ilike.%${q}%`,
    )
  }
  if (filters.status) builder = builder.eq('status', filters.status)
  if (filters.branch_id) builder = builder.eq('branch_id', filters.branch_id)

  const { data, error, count } = await builder
  if (error) throw error

  return {
    items: (data ?? []).map((row) => mapEmployee(row as EmployeeRow)),
    total: count ?? 0,
  }
}

export async function getEmployeeStats(): Promise<{
  total: number
  active: number
  with_device_id: number
}> {
  const { data, error } = await supabase
    .from('employees')
    .select('id, status, employee_device_mappings(device_user_id, is_active)')
    .is('deleted_at', null)

  if (error) throw error

  const rows = data ?? []
  const withDevice = rows.filter((row) =>
    ((row.employee_device_mappings ?? []) as Array<{ is_active: boolean }>).some((m) => m.is_active),
  )

  return {
    total: rows.length,
    active: rows.filter((row) => row.status === 'active').length,
    with_device_id: withDevice.length,
  }
}

export async function createEmployee(
  organizationId: string,
  input: EmployeeInput,
): Promise<Employee> {
  const payload = {
    organization_id: organizationId,
    employee_code: input.employee_code.trim(),
    full_name: input.full_name.trim(),
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    branch_id: input.branch_id || null,
    department: input.department?.trim() || null,
    designation: input.designation?.trim() || null,
    shift_name: input.shift_name?.trim() || null,
    basic_salary: input.basic_salary ?? 0,
    employment_type: input.employment_type ?? 'full_time',
    salary_type: input.salary_type ?? 'monthly',
    status: input.status ?? 'active',
    profile_id: input.profile_id ?? null,
    commission_eligible: input.commission_eligible ?? false,
    commission_payment_mode: input.commission_payment_mode ?? 'select_at_approval',
    include_commission_in_payroll: input.include_commission_in_payroll ?? true,
    notes: input.notes?.trim() || null,
  } as TablesInsert<'employees'>

  const { data, error } = await supabase.from('employees').insert(payload).select('*').single()
  if (error) throw error
  return data
}

export async function updateEmployee(id: string, input: EmployeeInput): Promise<Employee> {
  const payload = {
    employee_code: input.employee_code.trim(),
    full_name: input.full_name.trim(),
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    branch_id: input.branch_id || null,
    department: input.department?.trim() || null,
    designation: input.designation?.trim() || null,
    shift_name: input.shift_name?.trim() || null,
    basic_salary: input.basic_salary ?? 0,
    employment_type: input.employment_type ?? 'full_time',
    salary_type: input.salary_type ?? 'monthly',
    status: input.status ?? 'active',
    profile_id: input.profile_id ?? null,
    commission_eligible: input.commission_eligible ?? false,
    commission_payment_mode: input.commission_payment_mode ?? 'select_at_approval',
    include_commission_in_payroll: input.include_commission_in_payroll ?? true,
    notes: input.notes?.trim() || null,
  } as TablesUpdate<'employees'>

  const { data, error } = await supabase.from('employees').update(payload).eq('id', id).select('*').single()
  if (error) throw error
  return data
}

export async function linkEmployeeProfile(employeeId: string, profileId: string | null) {
  const { data, error } = await untypedRpc('link_employee_profile', {
    p_employee_id: employeeId,
    p_profile_id: profileId,
  })
  if (error) throw error
  return data
}

export async function softDeleteEmployee(id: string): Promise<void> {
  const { error } = await supabase
    .from('employees')
    .update({ deleted_at: new Date().toISOString(), status: 'inactive' })
    .eq('id', id)
  if (error) throw error
}
