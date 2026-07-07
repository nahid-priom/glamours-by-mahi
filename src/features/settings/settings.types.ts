import type { UserRole } from '@/lib/constants'

export interface CompanyProfile {
  company_name: string
  phone: string
  email: string
  website: string
  address: string
  logo_url: string
}

export type LabelSize = '100x150' | '80x100'
export type DefaultPrintType = 'invoice' | 'shipping_label' | 'gift_label'

export interface PrintSettings {
  invoice_prefix: string
  label_size: LabelSize
  show_powered_by: boolean
  default_print_type: DefaultPrintType
}

export interface ApiSettings {
  courier_provider_default: string
  fraud_provider_default: string
  sms_api_placeholder: string
}

export interface RoleEntry {
  id: string
  name: UserRole | string
  description: string
  permissions: string[]
  is_active: boolean
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

export interface SystemPreferences {
  language: string
  timezone: string
  date_format: string
  currency: string
}

export interface AppSettings {
  company: CompanyProfile
  print: PrintSettings
  api: ApiSettings
  roles: RoleEntry[]
  preferences: SystemPreferences
  updated_at: string
}

export interface UpdateCompanyInput extends Partial<CompanyProfile> {}
export interface UpdatePrintInput extends Partial<PrintSettings> {}
export interface UpdateApiInput extends Partial<ApiSettings> {}

export interface RoleFormInput {
  name: string
  description: string
  permissions: string[]
  is_active: boolean
}
