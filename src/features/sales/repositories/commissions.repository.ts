import { supabase } from '@/lib/supabase/client'
import type { Json } from '@/types/database'

type UntypedRpc = (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>

const untypedRpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc

export type CommissionEmployeeOption = {
  id: string
  label: string
  description: string
  profileId: string | null
}

export type CommissionSubjectOption = {
  id: string
  kind: 'employee' | 'profile'
  label: string
  description: string
  profileId: string | null
}

export type CommissionTier = {
  min_amount: number
  max_amount: number | null
  rate_type: 'percent' | 'fixed'
  rate: number
}

export type CommissionStructureMode = 'per_sale' | 'sale_amount_tiers' | 'period_volume_tiers'
export type CommissionSubjectType = 'employee' | 'profile'
export type CommissionOrderSource =
  | 'pos'
  | 'moderator'
  | 'tele_sales'
  | 'ecommerce'
  | 'manual'
  | 'other'

export type CommissionRuleRow = {
  id: string
  profile_id: string | null
  employee_id: string | null
  subject_type: CommissionSubjectType | string | null
  branch_id: string | null
  rule_type: string
  rate: number
  structure_mode: CommissionStructureMode | string | null
  base_metric: string | null
  tiers: CommissionTier[] | null
  period_unit: string | null
  applies_to_sources: string[] | null
  is_active: boolean
  effective_from: string
  effective_to: string | null
  notes: string | null
  created_at: string
}

export type UpsertCommissionRuleInput = {
  subject_type: CommissionSubjectType
  employee_id?: string | null
  profile_id?: string | null
  branch_id?: string | null
  structure_mode: CommissionStructureMode
  rule_type?: 'fixed' | 'percent_sale' | 'percent_profit' | 'none'
  rate?: number
  base_metric?: 'sale_total' | 'profit'
  tiers?: CommissionTier[]
  period_unit?: 'month'
  applies_to_sources?: CommissionOrderSource[]
  effective_from?: string
  notes?: string
}

export type CommissionFilters = {
  status?: string | null
  employeeId?: string | null
}

export type SalesCommissionRow = {
  id: string
  profile_id: string | null
  employee_id: string | null
  sale_id: string | null
  base_amount: number
  commission_amount: number
  reversed_amount?: number | null
  original_commission_amount?: number | null
  status: string
  needs_employee_link: boolean
  created_at: string
  product_name?: string | null
  variant_name?: string | null
  qty?: number | null
  event_type?: string | null
  profiles?: { full_name: string } | null
  employees?: { full_name: string; employee_code: string; designation: string | null } | null
  sales?: { invoice_no: string } | null
}

function normalizeTiers(raw: unknown): CommissionTier[] {
  if (!Array.isArray(raw)) return []
  return raw.map((t) => {
    const row = t as Record<string, unknown>
    return {
      min_amount: Number(row.min_amount ?? 0),
      max_amount: row.max_amount == null || row.max_amount === '' ? null : Number(row.max_amount),
      rate_type: row.rate_type === 'fixed' ? 'fixed' : 'percent',
      rate: Number(row.rate ?? 0),
    }
  })
}

function mapRule(row: Record<string, unknown>): CommissionRuleRow {
  return {
    id: String(row.id),
    profile_id: (row.profile_id as string | null) ?? null,
    employee_id: (row.employee_id as string | null) ?? null,
    subject_type: (row.subject_type as string | null) ?? null,
    branch_id: (row.branch_id as string | null) ?? null,
    rule_type: String(row.rule_type ?? 'none'),
    rate: Number(row.rate ?? 0),
    structure_mode: (row.structure_mode as string | null) ?? 'per_sale',
    base_metric: (row.base_metric as string | null) ?? 'sale_total',
    tiers: normalizeTiers(row.tiers),
    period_unit: (row.period_unit as string | null) ?? 'month',
    applies_to_sources: Array.isArray(row.applies_to_sources)
      ? (row.applies_to_sources as string[])
      : null,
    is_active: Boolean(row.is_active),
    effective_from: String(row.effective_from ?? ''),
    effective_to: (row.effective_to as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    created_at: String(row.created_at ?? ''),
  }
}

async function listCommissionRules(branchId?: string | null) {
  const { data, error } = await supabase.rpc('list_commission_rules', {
    p_branch_id: branchId ?? undefined,
  })
  if (error) throw error
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(mapRule)
}

async function upsertCommissionRule(input: UpsertCommissionRuleInput) {
  const { data, error } = await supabase.rpc('upsert_commission_rule', {
    payload: input as unknown as Json,
  })
  if (error) throw error
  return data
}

async function deactivateCommissionRule(ruleId: string) {
  const { data, error } = await supabase.rpc('deactivate_commission_rule', {
    p_rule_id: ruleId,
  })
  if (error) throw error
  return data
}

async function searchCommissionEmployees(
  query: string,
  branchId?: string | null,
  commissionOnly = true,
): Promise<CommissionEmployeeOption[]> {
  const { data, error } = await untypedRpc('search_commission_employees', {
    p_query: query.trim() || null,
    p_branch_id: branchId ?? null,
    p_commission_only: commissionOnly,
  })
  if (error) throw error

  return ((data ?? []) as Array<{
    id: string
    employee_code: string
    full_name: string
    designation: string
    branch_name: string
    profile_id: string | null
    profile_name: string | null
  }>).map((row) => ({
    id: row.id,
    label: `${row.full_name} (${row.employee_code})`,
    description: [row.designation, row.branch_name].filter(Boolean).join(' · '),
    profileId: row.profile_id,
  }))
}

async function searchCommissionSubjects(
  query: string,
  kind: 'all' | 'employee' | 'profile' = 'all',
  branchId?: string | null,
): Promise<CommissionSubjectOption[]> {
  const { data, error } = await untypedRpc('search_commission_subjects', {
    p_query: query.trim() || null,
    p_kind: kind,
    p_branch_id: branchId ?? null,
  })
  if (error) throw error

  const payload = (data ?? {}) as {
    employees?: Array<Record<string, unknown>>
    profiles?: Array<Record<string, unknown>>
  }

  const employees = (payload.employees ?? []).map((row) => ({
    id: String(row.id),
    kind: 'employee' as const,
    label: String(row.label ?? ''),
    description: String(row.description ?? ''),
    profileId: (row.profile_id as string | null) ?? null,
  }))
  const profiles = (payload.profiles ?? []).map((row) => ({
    id: String(row.id),
    kind: 'profile' as const,
    label: String(row.label ?? ''),
    description: String(row.description ?? ''),
    profileId: (row.profile_id as string | null) ?? String(row.id),
  }))

  if (kind === 'employee') return employees
  if (kind === 'profile') return profiles
  return [...employees, ...profiles]
}

/** @deprecated Use searchCommissionEmployees — profile-only search retained for legacy rows */
async function searchSalespeople(query: string) {
  const q = query.trim()
  let builder = supabase
    .from('profiles')
    .select('id, full_name, email')
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('full_name')
    .limit(20)
  if (q) builder = builder.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
  const { data, error } = await builder
  if (error) throw error
  return (data ?? []).map((p) => ({
    id: p.id,
    label: p.full_name,
    description: p.email ?? '',
    profileId: p.id,
  }))
}

async function listCommissions(filters: CommissionFilters = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  let q = db
    .from('salesman_commissions')
    .select(
      `id, profile_id, employee_id, sale_id, base_amount, commission_amount,
       reversed_amount, original_commission_amount, status,
       needs_employee_link, created_at,
       product_name, variant_name, qty, event_type,
       profiles!salesman_commissions_profile_id_fkey(full_name),
       employees!salesman_commissions_employee_id_fkey(full_name, employee_code, designation),
       sales!salesman_commissions_sale_id_fkey(invoice_no)`,
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200)
  if (filters.status) q = q.eq('status', filters.status)
  if (filters.employeeId) q = q.eq('employee_id', filters.employeeId)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as SalesCommissionRow[]
}

async function approveCommission(id: string) {
  const { data, error } = await supabase.rpc('approve_sales_commission', {
    p_commission_id: id,
  })
  if (error) throw error
  return data
}

async function payCommission(id: string, financialAccountId: string) {
  const clientTxnKey =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `comm-${Date.now()}`
  const { data, error } = await supabase.rpc('pay_sales_commission', {
    payload: {
      commission_id: id,
      financial_account_id: financialAccountId,
      client_txn_key: clientTxnKey,
    } as unknown as Json,
  })
  if (error) throw error
  return data
}

async function listFinancialAccounts() {
  const { data, error } = await supabase
    .from('financial_accounts')
    .select('id, name')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name')
  if (error) throw error
  return data ?? []
}

export const commissionsRepository = {
  listCommissions,
  listCommissionRules,
  upsertCommissionRule,
  deactivateCommissionRule,
  searchCommissionEmployees,
  searchCommissionSubjects,
  searchSalespeople,
  approveCommission,
  payCommission,
  listFinancialAccounts,
}
