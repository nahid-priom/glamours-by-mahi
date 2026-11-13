import type { Json } from '@/types/database'
import { supabase } from '@/lib/supabase/client'
import type {
  AppSettings,
  RoleEntry,
  RoleFormInput,
  UpdateApiInput,
  UpdateCompanyInput,
  UpdatePrintInput,
} from './settings.types'
import { APP_NAME } from '@/lib/constants'

type UntypedRpc = (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>

const untypedRpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc

const SETTINGS_BLOB_KEY = 'app_settings'

const defaultSettings = (): Omit<AppSettings, 'roles' | 'updated_at'> => ({
  company: {
    company_name: APP_NAME,
    phone: '',
    email: '',
    website: '',
    address: '',
    logo_url: '',
  },
  print: {
    invoice_prefix: 'INV',
    label_size: '100x150',
    show_powered_by: true,
    default_print_type: 'invoice',
  },
  api: {
    courier_provider_default: 'Steadfast',
    fraud_provider_default: '',
    sms_api_placeholder: 'Not configured',
  },
  preferences: {
    language: 'en',
    timezone: 'Asia/Dhaka',
    date_format: 'DD/MM/YYYY',
    currency: 'BDT',
  },
})

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

async function requireOrgId() {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', (await supabase.auth.getUser()).data.user?.id ?? '')
    .maybeSingle()
  if (error) throw error
  if (!profile?.organization_id) throw new Error('Organization not found for current user')
  return profile.organization_id
}

function normalizePermissionKeys(permissionKeys: string[]) {
  const desired = [...new Set(permissionKeys.filter((k) => k && k !== '*'))]
  if (!desired.length) throw new Error('Select at least one permission')
  return desired
}

async function loadRoles(): Promise<RoleEntry[]> {
  const { data, error } = await supabase
    .from('roles')
    .select('id, name, description, is_system, created_at, updated_at, deleted_at')
    .order('name')
  if (error) throw error

  const roleIds = (data ?? []).map((r) => r.id)
  const permByRole = new Map<string, string[]>()

  if (roleIds.length) {
    const { data: rp, error: rpErr } = await supabase
      .from('role_permissions')
      .select('role_id, permissions(key)')
      .in('role_id', roleIds)
      .is('deleted_at', null)
    if (rpErr) throw rpErr
    for (const row of rp ?? []) {
      const nested = row.permissions as { key: string } | { key: string }[] | null
      const key = Array.isArray(nested) ? nested[0]?.key : nested?.key
      if (!key) continue
      const list = permByRole.get(row.role_id) ?? []
      list.push(key)
      permByRole.set(row.role_id, list)
    }
  }

  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? '',
    permissions: permByRole.get(r.id) ?? [],
    is_active: !r.deleted_at,
    is_system: Boolean(r.is_system),
    created_at: r.created_at,
    updated_at: r.updated_at,
    deleted_at: r.deleted_at,
  }))
}

function mergeAppSettings(blob: unknown, orgName: string): Omit<AppSettings, 'roles'> {
  const root = asRecord(blob)
  const app = asRecord(root[SETTINGS_BLOB_KEY])
  const defaults = defaultSettings()
  const company = { ...defaults.company, ...asRecord(app.company) }
  if (!company.company_name) company.company_name = orgName
  return {
    company: {
      company_name: String(company.company_name ?? orgName),
      phone: String(company.phone ?? ''),
      email: String(company.email ?? ''),
      website: String(company.website ?? ''),
      address: String(company.address ?? ''),
      logo_url: String(company.logo_url ?? ''),
    },
    print: { ...defaults.print, ...asRecord(app.print) } as AppSettings['print'],
    api: { ...defaults.api, ...asRecord(app.api) } as AppSettings['api'],
    preferences: {
      ...defaults.preferences,
      ...asRecord(app.preferences),
    } as AppSettings['preferences'],
    updated_at: String(app.updated_at ?? new Date().toISOString()),
  }
}

async function patchOrgSettings(
  organizationId: string,
  patch: Partial<Omit<AppSettings, 'roles'>>,
) {
  const { data: org, error } = await supabase
    .from('organizations')
    .select('settings, name')
    .eq('id', organizationId)
    .single()
  if (error) throw error

  const current = mergeAppSettings(org.settings, org.name)
  const nextApp = {
    company: { ...current.company, ...patch.company },
    print: { ...current.print, ...patch.print },
    api: { ...current.api, ...patch.api },
    preferences: { ...current.preferences, ...patch.preferences },
    updated_at: new Date().toISOString(),
  }

  const merged = {
    ...asRecord(org.settings),
    [SETTINGS_BLOB_KEY]: nextApp,
  }

  const { error: upErr } = await supabase
    .from('organizations')
    .update({ settings: merged as Json })
    .eq('id', organizationId)
  if (upErr) throw upErr

  const roles = await loadRoles()
  return { ...nextApp, roles } satisfies AppSettings
}

export const settingsService = {
  async getSettings(): Promise<AppSettings> {
    const orgId = await requireOrgId()
    const { data: org, error } = await supabase
      .from('organizations')
      .select('settings, name')
      .eq('id', orgId)
      .single()
    if (error) throw error
    const base = mergeAppSettings(org.settings, org.name)
    const roles = await loadRoles()
    return { ...base, roles }
  },

  async updateCompany(input: UpdateCompanyInput): Promise<AppSettings> {
    const orgId = await requireOrgId()
    if (input.company_name?.trim()) {
      await supabase
        .from('organizations')
        .update({ name: input.company_name.trim() })
        .eq('id', orgId)
    }
    return patchOrgSettings(orgId, { company: input as AppSettings['company'] })
  },

  async updatePrint(input: UpdatePrintInput): Promise<AppSettings> {
    const orgId = await requireOrgId()
    return patchOrgSettings(orgId, { print: input as AppSettings['print'] })
  },

  async updateApi(input: UpdateApiInput): Promise<AppSettings> {
    const orgId = await requireOrgId()
    return patchOrgSettings(orgId, { api: input as AppSettings['api'] })
  },

  async createRole(input: RoleFormInput): Promise<AppSettings> {
    const permissions = normalizePermissionKeys(input.permissions)
    const { error } = await untypedRpc('create_role_with_permissions', {
      p_name: input.name.trim(),
      p_description: input.description || null,
      p_permission_keys: permissions,
    })
    if (error) throw new Error(error.message)
    return this.getSettings()
  },

  async updateRole(id: string, input: RoleFormInput): Promise<AppSettings> {
    const permissions = normalizePermissionKeys(input.permissions)
    const { error } = await untypedRpc('update_role_with_permissions', {
      p_role_id: id,
      p_name: input.name.trim(),
      p_description: input.description || null,
      p_permission_keys: permissions,
    })
    if (error) throw new Error(error.message)
    return this.getSettings()
  },

  async archiveRole(id: string): Promise<AppSettings> {
    const { error } = await supabase
      .from('roles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('is_system', false)
    if (error) throw error
    return this.getSettings()
  },

  async restoreRole(id: string): Promise<AppSettings> {
    const { error } = await supabase
      .from('roles')
      .update({ deleted_at: null })
      .eq('id', id)
    if (error) throw error
    return this.getSettings()
  },
}
