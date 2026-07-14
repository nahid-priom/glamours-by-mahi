import type {
  AppSettings,
  RoleEntry,
  RoleFormInput,
  UpdateApiInput,
  UpdateCompanyInput,
  UpdatePrintInput,
} from './settings.types'
import { APP_NAME, COMPANY_NAME, ROLES } from '@/lib/constants'
import { generateId } from '@/lib/id'
import { auditUpdate, delay, nowIso } from '@/lib/service-utils'
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '@/lib/storage'

function defaultRoles(): RoleEntry[] {
  const now = nowIso()
  return ROLES.map((role) => ({
    id: generateId('role'),
    name: role,
    description: `${role} access level`,
    permissions: role === 'Super Admin' ? ['all'] : ['read', 'write'],
    is_active: true,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  }))
}

function defaultSettings(): AppSettings {
  const now = nowIso()
  return {
    company: {
      company_name: COMPANY_NAME,
      phone: '+880 1712-345678',
      email: 'hello@glamourousbymahi.com',
      website: 'https://glamourousbymahi.com',
      address: 'Level 2, Bashundhara City Shopping Mall, Panthapath, Dhaka',
      logo_url: '',
    },
    print: {
      invoice_prefix: 'REX',
      label_size: '100x150',
      show_powered_by: true,
      default_print_type: 'invoice',
    },
    api: {
      courier_provider_default: 'Steadfast',
      fraud_provider_default: 'BD Courier',
      sms_api_placeholder: 'Not configured',
    },
    roles: defaultRoles(),
    preferences: {
      language: 'en',
      timezone: 'Asia/Dhaka',
      date_format: 'DD/MM/YYYY',
      currency: 'BDT',
    },
    updated_at: now,
  }
}

function loadSettings(): AppSettings {
  const stored = getStorageItem<AppSettings | null>(STORAGE_KEYS.settings, null)
  if (!stored) {
    const seeded = defaultSettings()
    setStorageItem(STORAGE_KEYS.settings, seeded)
    return seeded
  }
  return stored
}

function saveSettings(settings: AppSettings): AppSettings {
  const next = { ...settings, updated_at: nowIso() }
  setStorageItem(STORAGE_KEYS.settings, next)
  return next
}

export const settingsService = {
  async getSettings(): Promise<AppSettings> {
    await delay()
    return loadSettings()
  },

  async updateCompany(input: UpdateCompanyInput): Promise<AppSettings> {
    await delay(250)
    const current = loadSettings()
    return saveSettings({
      ...current,
      company: { ...current.company, ...input },
    })
  },

  async updatePrint(input: UpdatePrintInput): Promise<AppSettings> {
    await delay(250)
    const current = loadSettings()
    return saveSettings({
      ...current,
      print: { ...current.print, ...input },
    })
  },

  async updateApi(input: UpdateApiInput): Promise<AppSettings> {
    await delay(250)
    const current = loadSettings()
    return saveSettings({
      ...current,
      api: { ...current.api, ...input },
    })
  },

  async getRoles(): Promise<RoleEntry[]> {
    await delay(150)
    return loadSettings().roles.filter((r) => !r.deleted_at)
  },

  async createRole(input: RoleFormInput): Promise<RoleEntry> {
    await delay(250)
    const now = nowIso()
    const role: RoleEntry = {
      id: generateId('role'),
      ...input,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    }
    const current = loadSettings()
    saveSettings({ ...current, roles: [...current.roles, role] })
    return role
  },

  async updateRole(id: string, input: Partial<RoleFormInput>): Promise<RoleEntry> {
    await delay(250)
    let updated: RoleEntry | null = null
    const current = loadSettings()
    const roles = current.roles.map((r) => {
      if (r.id !== id) return r
      updated = auditUpdate(r, input as Partial<RoleEntry>)
      return updated
    })
    if (!updated) throw new Error('Role not found')
    saveSettings({ ...current, roles })
    return updated
  },

  async archiveRole(id: string): Promise<void> {
    await delay(200)
    const current = loadSettings()
    const roles = current.roles.map((r) =>
      r.id === id ? auditUpdate(r, { deleted_at: nowIso(), is_active: false }) : r,
    )
    saveSettings({ ...current, roles })
  },

  async restoreRole(id: string): Promise<void> {
    await delay(200)
    const current = loadSettings()
    const roles = current.roles.map((r) =>
      r.id === id ? auditUpdate(r, { deleted_at: null, is_active: true }) : r,
    )
    saveSettings({ ...current, roles })
  },

  getAppName(): string {
    return APP_NAME
  },
}
