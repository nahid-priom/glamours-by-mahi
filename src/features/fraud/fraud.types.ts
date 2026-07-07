import type { FraudLevel } from '@/lib/constants'
import type { Customer } from '@/types'

export interface FraudCheckInput {
  phone: string
  cod_amount: number
  customer?: Customer | null
  has_duplicate_pending?: boolean
  order_id?: string
}

export type FraudRuleSeverity = 'low' | 'medium' | 'high' | 'blocked'
export type FraudApiStatus = 'connected' | 'disconnected' | 'failed'
export type FraudProvider = 'BD Courier' | 'FraudBD' | 'FraudPeek' | 'Custom API'

export interface FraudRule {
  id: string
  name: string
  rule_key: string
  description: string
  points: number
  threshold: number
  severity: FraudRuleSeverity
  is_active: boolean
  created_at: string
  updated_at: string
  deleted_at?: string | null
  created_by?: string | null
  updated_by?: string | null
}

export interface FraudRuleFormInput {
  name: string
  rule_key: string
  description: string
  points: number
  threshold: number
  severity: FraudRuleSeverity
  is_active: boolean
}

export interface FraudApiConfig {
  provider_name: FraudProvider
  api_base_url?: string
  api_key?: string
  status: FraudApiStatus
  monthly_limit: number
  used_checks: number
  last_sync_at?: string | null
}

export interface FraudCheck {
  id: string
  customer_id?: string
  phone: string
  order_id?: string
  provider: string
  internal_score: number
  external_score: number
  final_score: number
  risk_level: FraudLevel
  reasons: string[]
  raw_response?: unknown
  checked_at: string
}

export interface FraudStats {
  total_checks: number
  safe: number
  high_risk: number
  blocked: number
  api_checks_used: number
}

export interface HybridFraudResult {
  phone: string
  internal_score: number
  external_score: number
  final_score: number
  risk_level: FraudLevel
  reasons: string[]
  needs_call_confirmation: boolean
  recommended_action: string
  provider: string
  external_report?: ExternalFraudReport
  check_id?: string
}

export interface ExternalFraudCourierHistory {
  name: string
  delivered: number
  returned: number
}

export interface ExternalFraudReport {
  success: boolean
  phone: string
  total_orders: number
  delivered: number
  returned: number
  cancelled: number
  success_rate: number
  return_rate: number
  external_score: number
  risk_level: string
  couriers: ExternalFraudCourierHistory[]
  reasons: string[]
}

export interface FraudConnectionTestResult {
  success: boolean
  message: string
  latency_ms: number
  status: FraudApiStatus
}

export type { FraudLevel }
