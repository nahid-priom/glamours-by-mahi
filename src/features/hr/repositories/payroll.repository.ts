import { supabase } from '@/lib/supabase/client'
import type { Tables } from '@/types/database'
import type { Json } from '@/types/database'

const untypedFrom = ((table: string) => (supabase as any).from(table)) as (table: string) => any

export type PayrollRun = Tables<'payroll_runs'>
export type PayrollItem = Tables<'payroll_items'>

export type PayrollRunListItem = PayrollRun & {
  branch_name: string | null
  employee_count: number
}

export type PayrollItemListItem = PayrollItem & {
  employee_name: string
  employee_code: string
  designation: string | null
  department: string | null
}

export type PayrollItemDetail = PayrollItemListItem & {
  payroll_runs: PayrollRun & { branches: { name: string } | null } | null
}

export type PayrollApprovalLog = {
  id: string
  action: string
  from_status: string | null
  to_status: string | null
  comments: string | null
  created_at: string
  created_by: string | null
  profiles: { full_name: string | null } | null
}

export type PayrollPaymentRecord = {
  id: string
  amount: number
  method: string
  reference: string | null
  paid_at: string
  financial_accounts: { name: string } | null
}

export type SalaryStructureRow = {
  id: string
  employee_id: string
  effective_from: string
  effective_to: string | null
  salary_type: string
  basic_salary: number
  notes: string | null
  employees: { full_name: string; employee_code: string; department: string | null } | null
  salary_structure_components: Array<{
    id: string
    component_type: string
    code: string
    name: string
    amount: number
  }>
}

export type EmployeeAdvanceRow = {
  id: string
  employee_id: string
  amount: number
  recovered_amount: number
  remaining_amount: number
  status: string
  reason: string | null
  created_at: string
  employees: { full_name: string; employee_code: string } | null
}

export type EmployeeLoanRow = {
  id: string
  employee_id: string
  principal: number
  installment_amount: number
  paid_amount: number
  remaining_amount: number
  status: string
  start_date: string
  employees: { full_name: string; employee_code: string } | null
}

export type PayrollFilters = {
  status?: string | null
  branchId?: string | null
  search?: string | null
  page?: number
  pageSize?: number
}

export type PayrollStats = {
  draft: number
  calculated: number
  reviewed: number
  approved: number
  payment_pending: number
  partially_paid: number
  paid: number
  total_gross: number
  total_deductions: number
  total_net: number
  total_paid: number
  outstanding: number
}

function range(page: number, pageSize: number) {
  const from = (page - 1) * pageSize
  return { from, to: from + pageSize - 1 }
}

type PayrollRunRow = PayrollRun & {
  branches: { name: string } | null
  payroll_items: Array<{ id: string }> | null
}

function mapRun(row: PayrollRunRow): PayrollRunListItem {
  return {
    ...row,
    branch_name: row.branches?.name ?? null,
    employee_count: row.payroll_items?.length ?? 0,
  }
}

function applyBranchFilter<T extends { or: (f: string) => T; eq: (c: string, v: string) => T }>(
  builder: T,
  branchId?: string | null,
): T {
  if (!branchId) return builder
  return builder.or(`branch_id.eq.${branchId},branch_id.is.null`)
}

export async function listPayrollRuns(
  filters: PayrollFilters = {},
): Promise<{ items: PayrollRunListItem[]; total: number }> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 30
  const { from, to } = range(page, pageSize)

  let builder = supabase
    .from('payroll_runs')
    .select('*, branches(name), payroll_items(id)', { count: 'exact' })
    .is('deleted_at', null)
    .order('period_start', { ascending: false })
    .range(from, to)

  if (filters.status) builder = builder.eq('status', filters.status)
  builder = applyBranchFilter(builder, filters.branchId)

  const { data, error, count } = await builder
  if (error) throw error

  let items = (data ?? []).map((row) => mapRun(row as PayrollRunRow))
  if (filters.search?.trim()) {
    const q = filters.search.trim().toLowerCase()
    items = items.filter(
      (row) =>
        row.period_label.toLowerCase().includes(q) ||
        (row.branch_name?.toLowerCase().includes(q) ?? false),
    )
  }

  return { items, total: count ?? items.length }
}

export async function getPayrollStats(filters: PayrollFilters = {}): Promise<PayrollStats> {
  let builder = supabase
    .from('payroll_runs')
    .select('status, total_gross, total_deductions, total_net')
    .is('deleted_at', null)

  if (filters.status) builder = builder.eq('status', filters.status)
  builder = applyBranchFilter(builder, filters.branchId)

  const { data, error } = await builder
  if (error) throw error

  const rows = data ?? []
  const countStatus = (status: string) => rows.filter((r) => r.status === status).length
  const totalNet = rows.reduce((s, r) => s + Number(r.total_net ?? 0), 0)

  return {
    draft: countStatus('draft'),
    calculated: countStatus('calculated'),
    reviewed: countStatus('reviewed'),
    approved: countStatus('approved'),
    payment_pending: countStatus('payment_pending'),
    partially_paid: countStatus('partially_paid'),
    paid: countStatus('paid'),
    total_gross: rows.reduce((s, r) => s + Number(r.total_gross ?? 0), 0),
    total_deductions: rows.reduce((s, r) => s + Number(r.total_deductions ?? 0), 0),
    total_net: totalNet,
    total_paid: rows
      .filter((r) => r.status === 'paid' || r.status === 'partially_paid')
      .reduce((s, r) => s + Number(r.total_net ?? 0), 0),
    outstanding: rows
      .filter((r) => !['paid', 'closed', 'cancelled'].includes(r.status))
      .reduce((s, r) => s + Number(r.total_net ?? 0), 0),
  }
}

export async function getPayrollRun(id: string): Promise<PayrollRunListItem | null> {
  const { data, error } = await supabase
    .from('payroll_runs')
    .select('*, branches(name), payroll_items(id)')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw error
  return data ? mapRun(data as PayrollRunRow) : null
}

export async function listPayrollItems(runId: string): Promise<PayrollItemListItem[]> {
  const { data, error } = await supabase
    .from('payroll_items')
    .select('*, employees(full_name, employee_code, designation, department)')
    .eq('payroll_run_id', runId)
    .is('deleted_at', null)
    .order('net_salary', { ascending: false })

  if (error) throw error

  return (data ?? []).map((row) => {
    const emp = row.employees as {
      full_name: string
      employee_code: string
      designation: string | null
      department: string | null
    } | null
    return {
      ...(row as PayrollItem),
      employee_name: emp?.full_name ?? '—',
      employee_code: emp?.employee_code ?? '—',
      designation: emp?.designation ?? null,
      department: emp?.department ?? null,
    }
  })
}

export async function getPayrollItem(itemId: string): Promise<PayrollItemDetail | null> {
  const { data, error } = await supabase
    .from('payroll_items')
    .select(
      '*, employees(full_name, employee_code, designation, department), payroll_runs(*, branches(name))',
    )
    .eq('id', itemId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const emp = data.employees as {
    full_name: string
    employee_code: string
    designation: string | null
    department: string | null
  } | null

  return {
    ...(data as PayrollItem),
    employee_name: emp?.full_name ?? '—',
    employee_code: emp?.employee_code ?? '—',
    designation: emp?.designation ?? null,
    department: emp?.department ?? null,
    payroll_runs: data.payroll_runs as PayrollItemDetail['payroll_runs'],
  }
}

export async function listPayrollApprovalLogs(runId: string): Promise<PayrollApprovalLog[]> {
  const { data, error } = await untypedFrom('payroll_approval_logs')
    .select('id, action, from_status, to_status, comments, created_at, created_by, profiles(full_name)')
    .eq('payroll_run_id', runId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as PayrollApprovalLog[]
}

export async function listPayrollPayments(runId: string): Promise<PayrollPaymentRecord[]> {
  const { data, error } = await untypedFrom('payroll_payments')
    .select('id, amount, method, reference, paid_at, financial_accounts(name)')
    .eq('payroll_run_id', runId)
    .is('deleted_at', null)
    .order('paid_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as PayrollPaymentRecord[]
}

export async function listSalaryStructures(): Promise<SalaryStructureRow[]> {
  const { data, error } = await untypedFrom('salary_structures')
    .select(
      'id, employee_id, effective_from, effective_to, salary_type, basic_salary, notes, employees(full_name, employee_code, department), salary_structure_components(id, component_type, code, name, amount)',
    )
    .is('deleted_at', null)
    .order('effective_from', { ascending: false })

  if (error) {
    if (error.code === '42P01') return []
    throw error
  }
  return (data ?? []) as SalaryStructureRow[]
}

export async function saveSalaryStructure(input: {
  employee_id: string
  effective_from: string
  salary_type: 'monthly' | 'daily' | 'hourly'
  basic_salary: number
  notes?: string | null
  components?: Array<{
    component_type: 'earning' | 'deduction'
    code: string
    name: string
    amount: number
  }>
}) {
  const empRes = await supabase
    .from('employees')
    .select('organization_id')
    .eq('id', input.employee_id)
    .single()
  if (empRes.error) throw empRes.error
  const orgId = (empRes.data as { organization_id: string }).organization_id

  const { data: runRow, error: runErr } = await untypedFrom('salary_structures')
    .insert({
      organization_id: orgId,
      employee_id: input.employee_id,
      effective_from: input.effective_from,
      salary_type: input.salary_type,
      basic_salary: input.basic_salary,
      notes: input.notes ?? null,
    })
    .select('id')
    .single()

  if (runErr) throw runErr

  const structureId = (runRow as { id: string }).id
  if (input.components?.length) {
    const { error: compErr } = await untypedFrom('salary_structure_components').insert(
      input.components.map((c) => ({
        organization_id: orgId,
        salary_structure_id: structureId,
        ...c,
      })),
    )
    if (compErr) throw compErr
  }

  return { id: structureId }
}

export async function listEmployeeAdvances(): Promise<EmployeeAdvanceRow[]> {
  const { data, error } = await untypedFrom('employee_advances')
    .select(
      'id, employee_id, amount, recovered_amount, remaining_amount, status, reason, created_at, employees(full_name, employee_code)',
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    if (error.code === '42P01') return []
    throw error
  }
  return (data ?? []) as EmployeeAdvanceRow[]
}

export async function listEmployeeLoans(): Promise<EmployeeLoanRow[]> {
  const { data, error } = await untypedFrom('employee_loans')
    .select(
      'id, employee_id, principal, installment_amount, paid_amount, remaining_amount, status, start_date, employees(full_name, employee_code)',
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    if (error.code === '42P01') return []
    throw error
  }
  return (data ?? []) as EmployeeLoanRow[]
}

export async function submitPayrollForReview(payrollRunId: string, comments?: string) {
  const { data, error } = await supabase.rpc(
    'submit_payroll_for_review' as never,
    {
      payload: { payroll_run_id: payrollRunId, comments: comments ?? null } as unknown as Json,
    } as never,
  )
  if (error) throw error
  return data as { payroll_run_id: string; status: string }
}

export async function listPayrollReportRows(filters: PayrollFilters = {}) {
  const { items } = await listPayrollRuns({ ...filters, pageSize: 500 })
  return items
}

export type CreatePayrollRunPayload = {
  branch_id?: string | null
  department?: string | null
  period_label: string
  period_start: string
  period_end: string
  payment_date?: string | null
  scope_type?: 'organization' | 'branch' | 'department' | 'selected'
  employee_ids?: string[]
  notes?: string | null
  client_txn_key: string
}

export async function createPayrollRun(payload: CreatePayrollRunPayload) {
  const { data, error } = await supabase.rpc(
    'create_payroll_run' as never,
    { payload: payload as unknown as Json } as never,
  )
  if (error) throw error
  return data as { payroll_run_id: string; idempotent?: boolean }
}

export async function calculatePayrollRun(payrollRunId: string, clientTxnKey: string) {
  const { data, error } = await supabase.rpc(
    'calculate_payroll_run' as never,
    {
      payload: { payroll_run_id: payrollRunId, client_txn_key: clientTxnKey } as unknown as Json,
    } as never,
  )
  if (error) throw error
  return data as { payroll_run_id: string; employee_count: number; idempotent?: boolean }
}

export async function approvePayrollRun(payrollRunId: string, comments?: string) {
  const { data, error } = await supabase.rpc(
    'approve_payroll_run' as never,
    {
      payload: {
        payroll_run_id: payrollRunId,
        comments: comments ?? null,
        client_txn_key: crypto.randomUUID(),
      } as unknown as Json,
    } as never,
  )
  if (error) throw error
  return data as { payroll_run_id: string; journal_entry_id?: string | null }
}

export async function rejectPayrollRun(payrollRunId: string, reason: string) {
  const { data, error } = await supabase.rpc(
    'reject_payroll_run' as never,
    { payload: { payroll_run_id: payrollRunId, reason } as unknown as Json } as never,
  )
  if (error) throw error
  return data as { payroll_run_id: string }
}

export type PayPayrollItemsPayload = {
  payroll_run_id: string
  financial_account_id: string
  method?: string
  amount?: number | null
  payroll_item_ids?: string[]
  reference?: string | null
  notes?: string | null
  client_txn_key: string
}

export async function payPayrollItems(payload: PayPayrollItemsPayload) {
  const { data, error } = await supabase.rpc(
    'pay_payroll_items' as never,
    { payload: payload as unknown as Json } as never,
  )
  if (error) throw error
  return data as {
    payroll_run_id: string
    amount_paid: number
    status: string
    idempotent?: boolean
  }
}

export async function listFinancialAccounts() {
  const { data, error } = await supabase
    .from('financial_accounts')
    .select('id, name, account_kind, current_balance')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name')
  if (error) throw error
  return data ?? []
}

export const payrollRepository = {
  listPayrollRuns,
  getPayrollStats,
  getPayrollRun,
  listPayrollItems,
  getPayrollItem,
  listPayrollApprovalLogs,
  listPayrollPayments,
  listSalaryStructures,
  saveSalaryStructure,
  listEmployeeAdvances,
  listEmployeeLoans,
  submitPayrollForReview,
  listPayrollReportRows,
  createPayrollRun,
  calculatePayrollRun,
  approvePayrollRun,
  rejectPayrollRun,
  payPayrollItems,
  listFinancialAccounts,
}
