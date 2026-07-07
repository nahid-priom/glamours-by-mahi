import type {
  FraudApiConfig,
  FraudCheck,
  FraudCheckInput,
  FraudProvider,
  FraudRule,
  FraudRuleFormInput,
  FraudStats,
  HybridFraudResult,
} from './fraud.types'
import { calculateFraudRisk, getFraudLevel } from './fraud.engine'
import { combineFraudScores, fraudApiDemoService } from './fraud-api-demo.service'
import { customersService } from '@/features/customers/customers.service'
import { MOCK_FRAUD_RULES } from '@/lib/mock-data'
import { generateId } from '@/lib/id'
import { auditCreate, auditUpdate, delay, nowIso } from '@/lib/service-utils'
import { getStorageItem, setStorageItem, STORAGE_KEYS, updateStorageItem } from '@/lib/storage'

const DEFAULT_API_CONFIG: FraudApiConfig = {
  provider_name: 'BD Courier',
  api_base_url: 'https://api.bdcourier.com/v1',
  api_key: 'bdc_demo_key_abcdef',
  status: 'connected',
  monthly_limit: 1000,
  used_checks: 42,
  last_sync_at: new Date().toISOString(),
}

function getRecommendedAction(level: string): string {
  switch (level) {
    case 'BLOCKED':
      return 'Do not ship'
    case 'HIGH':
      return 'Advance payment recommended'
    case 'MEDIUM':
      return 'Call confirmation'
    default:
      return 'Normal delivery'
  }
}

function loadRules(): FraudRule[] {
  const stored = getStorageItem<FraudRule[]>(STORAGE_KEYS.fraudRules, [])
  if (stored.length === 0) {
    setStorageItem(STORAGE_KEYS.fraudRules, MOCK_FRAUD_RULES)
    return MOCK_FRAUD_RULES
  }
  return stored
}

function loadChecks(): FraudCheck[] {
  return getStorageItem<FraudCheck[]>(STORAGE_KEYS.fraudChecks, [])
}

function loadApiConfig(): FraudApiConfig {
  return getStorageItem<FraudApiConfig>(STORAGE_KEYS.fraudApiConfig, DEFAULT_API_CONFIG)
}

function saveCheck(check: FraudCheck) {
  updateStorageItem(STORAGE_KEYS.fraudChecks, loadChecks(), (current) => [check, ...current])
}

export type { FraudCheckInput } from './fraud.types'
export { calculateFraudRisk, getFraudLevel, getFraudBadgeVariant } from './fraud.engine'

export const fraudService = {
  checkRisk(input: FraudCheckInput) {
    return calculateFraudRisk(input)
  },

  async getRules(includeDeleted = false) {
    await delay()
    const rules = loadRules()
    return includeDeleted ? rules : rules.filter((r) => !r.deleted_at)
  },

  async getRuleById(id: string) {
    await delay(150)
    return loadRules().find((r) => r.id === id) ?? null
  },

  async createRule(input: FraudRuleFormInput) {
    await delay(250)
    const existing = loadRules().find(
      (r) => r.rule_key === input.rule_key && !r.deleted_at,
    )
    if (existing) throw new Error('Rule key already exists')

    const rule = auditCreate({ ...input } as Record<string, unknown>, 'fr') as unknown as FraudRule
    updateStorageItem(STORAGE_KEYS.fraudRules, loadRules(), (current) => [rule, ...current])
    return rule
  },

  async updateRule(id: string, input: Partial<FraudRuleFormInput>) {
    await delay(250)
    let updated: FraudRule | null = null
    updateStorageItem(STORAGE_KEYS.fraudRules, loadRules(), (current) =>
      current.map((r) => {
        if (r.id !== id) return r
        updated = auditUpdate(r, input as Partial<FraudRule>)
        return updated
      }),
    )
    if (!updated) throw new Error('Rule not found')
    return updated
  },

  async toggleRule(id: string, is_active: boolean) {
    return this.updateRule(id, { is_active })
  },

  async softDeleteRule(id: string) {
    await delay(200)
    const now = nowIso()
    updateStorageItem(STORAGE_KEYS.fraudRules, loadRules(), (current) =>
      current.map((r) =>
        r.id === id ? { ...r, deleted_at: now, updated_at: now, is_active: false } : r,
      ),
    )
  },

  async restoreRule(id: string) {
    await delay(200)
    updateStorageItem(STORAGE_KEYS.fraudRules, loadRules(), (current) =>
      current.map((r) =>
        r.id === id ? { ...r, deleted_at: null, updated_at: nowIso() } : r,
      ),
    )
  },

  async getChecks() {
    await delay()
    return loadChecks()
  },

  async getApiConfig() {
    await delay(150)
    return loadApiConfig()
  },

  async updateApiConfig(config: Partial<FraudApiConfig>) {
    await delay(250)
    const current = loadApiConfig()
    const next: FraudApiConfig = {
      ...current,
      ...config,
      status: config.api_key ? 'connected' : 'disconnected',
      last_sync_at: nowIso(),
    }
    setStorageItem(STORAGE_KEYS.fraudApiConfig, next)
    return next
  },

  async testApiConnection(provider?: FraudProvider) {
    await delay(800)
    const config = loadApiConfig()
    return fraudApiDemoService.testFraudApiConnection(provider ?? config.provider_name)
  },

  async getStats(): Promise<FraudStats> {
    await delay(150)
    const checks = loadChecks()
    const customers = await customersService.getAll()
    const config = loadApiConfig()

    return {
      total_checks: checks.length,
      safe: customers.filter((c) => c.fraud_level === 'SAFE').length,
      high_risk: customers.filter((c) => c.fraud_level === 'HIGH' || c.fraud_level === 'MEDIUM').length,
      blocked: customers.filter((c) => c.fraud_level === 'BLOCKED' || c.is_blacklisted).length,
      api_checks_used: config.used_checks,
    }
  },

  async runHybridCheck(
    phone: string,
    options?: { cod_amount?: number; order_id?: string; provider?: FraudProvider },
  ): Promise<HybridFraudResult> {
    await delay(400)
    const customer = await customersService.getByPhone(phone)
    const cod_amount = options?.cod_amount ?? 0

    const internal = calculateFraudRisk({
      phone,
      cod_amount,
      customer,
    })

    const config = loadApiConfig()
    const provider = options?.provider ?? config.provider_name
    let external_score = 0
    let external_report

    if (config.api_key && config.status === 'connected') {
      external_report = await fraudApiDemoService.getExternalFraudReportDemo(phone)
      external_score = external_report.external_score

      updateStorageItem(STORAGE_KEYS.fraudApiConfig, loadApiConfig(), (current) => ({
        ...current,
        used_checks: current.used_checks + 1,
        last_sync_at: nowIso(),
      }))
    }

    let final_score: number
    let risk_level = internal.level
    const reasons = [...internal.reasons]

    if (customer?.is_blacklisted) {
      final_score = 95
      risk_level = 'BLOCKED'
      reasons.push('Customer is blacklisted')
    } else if (external_report) {
      final_score = combineFraudScores(internal.score, external_score)
      risk_level = getFraudLevel(final_score)
      reasons.push(...external_report.reasons.filter((r) => !reasons.includes(r)))
    } else {
      final_score = internal.score
    }

    const check: FraudCheck = {
      id: generateId('fc'),
      customer_id: customer?.id,
      phone,
      order_id: options?.order_id,
      provider,
      internal_score: internal.score,
      external_score,
      final_score,
      risk_level,
      reasons,
      raw_response: external_report,
      checked_at: nowIso(),
    }
    saveCheck(check)

    return {
      phone,
      internal_score: internal.score,
      external_score,
      final_score,
      risk_level,
      reasons,
      needs_call_confirmation: risk_level === 'HIGH' || risk_level === 'BLOCKED',
      recommended_action: getRecommendedAction(risk_level),
      provider,
      external_report,
      check_id: check.id,
    }
  },

  async blockCustomer(customerId: string, reason: string) {
    return customersService.blacklist(customerId, reason)
  },

  async unblockCustomer(customerId: string) {
    return customersService.unblacklist(customerId)
  },
}
