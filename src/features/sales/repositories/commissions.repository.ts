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
  /** Inclusive calendar date (Asia/Dhaka), filters on created_at */
  dateFrom?: string | null
  /** Inclusive calendar date (Asia/Dhaka); converted to exclusive end bound */
  dateTo?: string | null
  page?: number
  pageSize?: number
}

export type CommissionListResult = {
  items: SalesCommissionRow[]
  total: number
  page: number
  pageSize: number
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
  approved_at?: string | null
  paid_at?: string | null
  notes?: string | null
  product_name?: string | null
  variant_name?: string | null
  qty?: number | null
  event_type?: string | null
  profiles?: { full_name: string } | null
  employees?: { full_name: string; employee_code: string; designation: string | null } | null
  sales?: { invoice_no: string } | null
}

export type SaleCommissionAuditRow = {
  id: string
  profile_id: string | null
  employee_id: string | null
  base_amount: number
  commission_amount: number
  reversed_amount: number | null
  original_commission_amount: number | null
  recoverable_amount: number | null
  status: string
  rule_snapshot: unknown
  notes: string | null
  created_at: string
  approved_at: string | null
  paid_at: string | null
  profile_name: string | null
  employee_name: string | null
  employee_code: string | null
}

export type SaleCommissionAudit = {
  sale_id: string
  invoice_no: string
  sale_status: string
  summary: {
    accrued: number
    reversed: number
    net_earned: number
    paid: number
    outstanding: number
    recoverable: number
    row_count: number
  }
  commissions: SaleCommissionAuditRow[]
  exceptions: Array<{
    id: string
    reason: string
    created_at: string
    resolved_at: string | null
  }>
}

export type SalesCommissionsSummary = {
  accrued: number
  pending: number
  approved: number
  paid: number
  reversed: number
  net_earned: number
  outstanding: number
  recoverable: number
  exceptions: number
  row_count: number
}

export type CommissionDiscrepancyReport = {
  dry_run: boolean
  organization_id: string
  examined_categories: string[]
  discrepancy_count: number
  total_exposure: number
  items: Array<{
    category: string
    severity: string
    sale_id?: string
    invoice_no?: string | null
    actual_earning?: number
    expected_earning?: number
    difference?: number | null
    reason?: string
  }>
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

function nextDhakaDayIso(ymd: string) {
  // Inclusive start / exclusive end: dateTo + 1 calendar day at 00:00 Asia/Dhaka
  const [y, m, d] = ymd.split('-').map(Number)
  const utcMs = Date.UTC(y, m - 1, d) + 24 * 60 * 60 * 1000
  const next = new Date(utcMs)
  const yy = next.getUTCFullYear()
  const mm = String(next.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(next.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}T00:00:00+06:00`
}

async function listCommissions(filters: CommissionFilters = {}): Promise<CommissionListResult> {
  const page = Math.max(1, filters.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 50))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  let q = db
    .from('salesman_commissions')
    .select(
      `id, profile_id, employee_id, sale_id, base_amount, commission_amount,
       reversed_amount, original_commission_amount, status,
       needs_employee_link, created_at, approved_at, paid_at, notes,
       product_name, variant_name, qty, event_type,
       profiles!salesman_commissions_profile_id_fkey(full_name),
       employees!salesman_commissions_employee_id_fkey(full_name, employee_code, designation),
       sales!salesman_commissions_sale_id_fkey(invoice_no)`,
      { count: 'exact' },
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)
  if (filters.status) q = q.eq('status', filters.status)
  if (filters.employeeId) q = q.eq('employee_id', filters.employeeId)
  // Date semantic: accrual/created_at in Asia/Dhaka (inclusive start, exclusive end)
  if (filters.dateFrom) q = q.gte('created_at', `${filters.dateFrom}T00:00:00+06:00`)
  if (filters.dateTo) q = q.lt('created_at', nextDhakaDayIso(filters.dateTo))
  const { data, error, count } = await q
  if (error) throw error
  return {
    items: (data ?? []) as SalesCommissionRow[],
    total: count ?? 0,
    page,
    pageSize,
  }
}

async function approveCommission(id: string) {
  const { data, error } = await supabase.rpc('approve_sales_commission', {
    p_commission_id: id,
  })
  if (error) throw error
  return data
}

async function approveCommissionsBulk(ids: string[]) {
  const { data, error } = await untypedRpc('bulk_approve_sales_commissions', {
    p_commission_ids: ids,
  })
  if (error) {
    // Fallback when migration 131 is not yet applied: sequential approve with per-id results
    const results: Array<{ id: string; ok: boolean; error?: string }> = []
    for (const id of ids) {
      try {
        await approveCommission(id)
        results.push({ id, ok: true })
      } catch (e) {
        results.push({ id, ok: false, error: e instanceof Error ? e.message : 'Failed' })
      }
    }
    return results
  }
  const payload = data as {
    ok?: number
    fail?: number
    results?: Array<{ id: string; ok: boolean; error?: string }>
  } | null
  return (payload?.results ?? []).map((r) => ({
    id: String(r.id),
    ok: Boolean(r.ok),
    error: r.error,
  }))
}

async function rejectCommission(id: string, reason?: string) {
  const { data, error } = await supabase.rpc('reject_sales_commission', {
    p_commission_id: id,
    p_reason: reason || undefined,
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

async function getSaleCommissionAudit(saleId: string): Promise<SaleCommissionAudit> {
  const { data, error } = await untypedRpc('get_sale_commission_audit', {
    p_sale_id: saleId,
  })
  if (error) throw error
  const payload = (data ?? {}) as Record<string, unknown>
  const summary = (payload.summary ?? {}) as Record<string, unknown>
  return {
    sale_id: String(payload.sale_id ?? saleId),
    invoice_no: String(payload.invoice_no ?? ''),
    sale_status: String(payload.sale_status ?? ''),
    summary: {
      accrued: Number(summary.accrued ?? 0),
      reversed: Number(summary.reversed ?? 0),
      net_earned: Number(summary.net_earned ?? 0),
      paid: Number(summary.paid ?? 0),
      outstanding: Number(summary.outstanding ?? 0),
      recoverable: Number(summary.recoverable ?? 0),
      row_count: Number(summary.row_count ?? 0),
    },
    commissions: Array.isArray(payload.commissions)
      ? (payload.commissions as SaleCommissionAuditRow[])
      : [],
    exceptions: Array.isArray(payload.exceptions)
      ? (payload.exceptions as SaleCommissionAudit['exceptions'])
      : [],
  }
}

async function summarizeSalesCommissions(
  filters: Pick<CommissionFilters, 'status' | 'employeeId' | 'dateFrom' | 'dateTo'> = {},
): Promise<SalesCommissionsSummary> {
  const { data, error } = await untypedRpc('summarize_sales_commissions', {
    p_status: filters.status ?? null,
    p_profile_id: null,
    p_employee_id: filters.employeeId ?? null,
    p_from: filters.dateFrom ?? null,
    p_to: filters.dateTo ?? null,
  })
  if (error) throw error
  const payload = (data ?? {}) as Record<string, unknown>
  return {
    accrued: Number(payload.accrued ?? 0),
    pending: Number(payload.pending ?? 0),
    approved: Number(payload.approved ?? 0),
    paid: Number(payload.paid ?? 0),
    reversed: Number(payload.reversed ?? 0),
    net_earned: Number(payload.net_earned ?? 0),
    outstanding: Number(payload.outstanding ?? 0),
    recoverable: Number(payload.recoverable ?? 0),
    exceptions: Number(payload.exceptions ?? 0),
    row_count: Number(payload.row_count ?? 0),
  }
}

async function auditCommissionDiscrepancies(limit = 200): Promise<CommissionDiscrepancyReport> {
  const { data, error } = await untypedRpc('audit_commission_discrepancies', {
    p_limit: limit,
  })
  if (error) throw error
  const payload = (data ?? {}) as Record<string, unknown>
  return {
    dry_run: Boolean(payload.dry_run ?? true),
    organization_id: String(payload.organization_id ?? ''),
    examined_categories: Array.isArray(payload.examined_categories)
      ? (payload.examined_categories as string[])
      : [],
    discrepancy_count: Number(payload.discrepancy_count ?? 0),
    total_exposure: Number(payload.total_exposure ?? 0),
    items: Array.isArray(payload.items)
      ? (payload.items as CommissionDiscrepancyReport['items'])
      : [],
  }
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
  approveCommissionsBulk,
  rejectCommission,
  payCommission,
  listFinancialAccounts,
  getSaleCommissionAudit,
  summarizeSalesCommissions,
  auditCommissionDiscrepancies,
}
