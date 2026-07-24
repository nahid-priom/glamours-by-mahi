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

export type CommissionRuleRow = {
  id: string
  profile_id: string | null
  employee_id: string | null
  branch_id: string | null
  rule_type: string
  rate: number
  is_active: boolean
  effective_from: string
  effective_to: string | null
  notes: string | null
  created_at: string
}

export type SalesCommissionRow = {
  id: string
  profile_id: string | null
  employee_id: string | null
  sale_id: string | null
  base_amount: number
  commission_amount: number
  status: string
  needs_employee_link: boolean
  created_at: string
  profiles?: { full_name: string } | null
  employees?: { full_name: string; employee_code: string; designation: string | null } | null
  sales?: { invoice_no: string } | null
}

async function listCommissionRules(branchId?: string | null) {
  const { data, error } = await supabase.rpc('list_commission_rules', {
    p_branch_id: branchId ?? undefined,
  })
  if (error) throw error
  return (data ?? []) as unknown as CommissionRuleRow[]
}

async function upsertCommissionRule(input: {
  employee_id: string
  branch_id?: string | null
  rule_type: 'fixed' | 'percent_sale' | 'percent_profit' | 'none'
  rate: number
  effective_from?: string
  notes?: string
}) {
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

async function listCommissions(status?: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  let q = db
    .from('salesman_commissions')
    .select(
      `id, profile_id, employee_id, sale_id, base_amount, commission_amount, status,
       needs_employee_link, created_at,
       profiles(full_name),
       employees(full_name, employee_code, designation),
       sales(invoice_no)`,
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100)
  if (status) q = q.eq('status', status)
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
  searchSalespeople,
  approveCommission,
  payCommission,
  listFinancialAccounts,
}
