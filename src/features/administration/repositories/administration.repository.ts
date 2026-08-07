import { supabase } from '@/lib/supabase/client'

type UntypedRpc = (fn: string, args?: object) => Promise<{ data: unknown; error: { message: string } | null }>
const untypedRpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc

export type AdminUserRow = {
  id: string
  full_name: string
  email: string
  username?: string | null
  phone: string | null
  role_id: string | null
  role_name: string | null
  default_branch_id: string | null
  is_active: boolean
  employee_id?: string | null
  employee_name?: string | null
  employee_code?: string | null
  created_at: string
}

export type AdminRoleRow = {
  id: string
  name: string
  description: string | null
  is_system: boolean
  permission_count: number
}

export async function listAdminUsers(search = ''): Promise<AdminUserRow[]> {
  const { data, error } = await untypedRpc('list_admin_users', {
    payload: { search: search || null, limit: 100 },
  })
  if (error) throw error
  return (data ?? []) as AdminUserRow[]
}

export async function getAdminUserDetail(userId: string) {
  const { data, error } = await untypedRpc('get_admin_user_detail', { p_user_id: userId })
  if (error) throw error
  return data as AdminUserRow & { branch_ids: string[] }
}

export async function updateAdminUser(payload: Record<string, unknown>) {
  const { data, error } = await untypedRpc('update_admin_user', { payload })
  if (error) throw error
  return data
}

export async function listAdminRoles(): Promise<AdminRoleRow[]> {
  const { data, error } = await untypedRpc('list_admin_roles')
  if (error) throw error
  return (data ?? []) as AdminRoleRow[]
}

export async function createAdminUser(payload: {
  employee_id: string
  role_id: string
  username: string
  password: string
  default_branch_id?: string | null
  branch_ids?: string[]
  email?: string | null
}) {
  const { data, error } = await supabase.functions.invoke('admin-create-user', { body: payload })
  if (error) throw error
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error))
  }
  return data as {
    user_id: string
    email: string
    username: string
    created: boolean
  }
}

/** @deprecated Use createAdminUser — kept for tests/legacy call sites */
export async function inviteAdminUser(payload: {
  email: string
  full_name: string
  role_id: string
  default_branch_id?: string | null
  branch_ids?: string[]
}) {
  void payload
  throw new Error('Invite-by-email is replaced by Create staff user (employee + username + password)')
}

export async function resetAdminUserPassword(userId: string, newPassword: string) {
  const { data, error } = await supabase.functions.invoke('admin-reset-user-password', {
    body: { user_id: userId, new_password: newPassword },
  })
  if (error) throw error
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error))
  }
  return data as { user_id: string; ok: boolean }
}

export async function resolveStaffLoginEmail(identifier: string): Promise<string | null> {
  const { data, error } = await untypedRpc('resolve_staff_login_email', {
    p_identifier: identifier,
  })
  if (error) throw error
  return (data as string | null) ?? null
}

export async function previewDataReset(scope: Record<string, unknown> = {}) {
  const { data, error } = await untypedRpc('preview_data_reset', { payload: scope })
  if (error) throw error
  return data as { run_id: string; summary: Record<string, number | string> }
}

export async function executeDataReset(payload: {
  confirm: string
  confirm_phrase?: string
  reset_level?: 'demo' | 'transactions' | 'inventory' | 'accounts' | 'full'
  reset_inventory?: boolean
}) {
  const { data, error } = await untypedRpc('execute_data_reset', { payload })
  if (error) throw error
  return data as { run_id: string; ok: boolean }
}
