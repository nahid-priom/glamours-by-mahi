import { supabase } from '@/lib/supabase/client'
import type { Json } from '@/types/database'

export type TxnDirection = 'in' | 'out' | 'all'
export type AccountKind = 'cash' | 'bank' | 'mobile_money' | 'other'

export type DateRange = { from: string; to: string }

export type TxnFilters = {
  from?: string
  to?: string
  direction?: TxnDirection
  accountId?: string | null
  branchId?: string | null
  search?: string
  limit?: number
}

export type FinancialAccountRow = {
  id: string
  name: string
  account_kind: AccountKind
  branch_id: string | null
  opening_balance: number
  current_balance: number
  is_default: boolean
  is_active: boolean
  chart_account_id: string | null
}

export type SimpleTransaction = {
  id: string
  entryId?: string
  entryNo?: string
  date: string
  description: string
  accountId: string | null
  accountName: string | null
  direction: 'in' | 'out'
  amount: number
  category?: string | null
  voided: boolean
  sourceType?: string | null
  balanceAfter?: number | null
}

export type NamedCategory = { id: string; name: string }

export type IncomeExpenseRow = {
  id: string
  entryId: string
  entryNo: string
  date: string
  category: string
  description: string
  amount: number
  sourceType: string
  transactionId: string | null
  accountName: string | null
}

export type DashboardKpis = {
  /** Sum of active cash + bank + mobile_money balances */
  cashBalance: number
  /** Cash till / drawer only */
  cashDrawerBalance: number
  bankBalance: number
  mobileBalance: number
  moneyIn: number
  moneyOut: number
  customerDue: number
  supplierDue: number
  netProfit: number
  todaySales: number
  todayCollection: number
  todayExpenses: number
  todayProfit: number
  monthProfit: number
  recent: SimpleTransaction[]
  recentTxns: SimpleTransaction[]
}

export type ProfitLossResult = {
  netSales: number
  productCost: number
  grossProfit: number
  otherIncome: number
  expenses: number
  netProfit: number
  margin: number
  /** @deprecated alias of grossProfit for existing UI */
  gross: number
  from: string
  to: string
}

export type AccountSettings = {
  incomeCategories: string[]
  expenseCategories: string[]
  defaultCashAccountId: string | null
  defaultBankAccountId: string | null
  defaultPurchasePaymentAccountId: string | null
  allowNegativeBalance: boolean
  requireDailyClosing: boolean
  expenseApprovalLimit: number
  allowCustomerAdvance: boolean
  allowSupplierAdvance: boolean
}

const DEFAULT_INCOME_CATEGORIES = [
  'Other Income',
  'Delivery Income',
  'Service Charge',
  'Commission Income',
  'Investment',
  'Miscellaneous',
]
const DEFAULT_EXPENSE_CATEGORIES = [
  'Shop Rent',
  'Salary',
  'Electricity',
  'Internet',
  'Courier',
  'Transport',
  'Marketing',
  'Packaging',
  'Maintenance',
  'Office Expense',
  'Staff Expense',
  'Miscellaneous',
]

const SETTINGS_KEY = 'simple_accounting'

/** Untyped access for tables not yet in Database stubs */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback
  const items = value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
  return items.length ? items : fallback
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function dayBounds(day: string) {
  return { start: `${day}T00:00:00.000Z`, end: `${day}T23:59:59.999Z` }
}

function n(value: unknown) {
  return Number(value) || 0
}

async function getOrgSettingsBlob(organizationId: string) {
  const { data, error } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', organizationId)
    .maybeSingle()
  if (error) throw error
  return asRecord(data?.settings)
}

async function listFinancialAccounts(branchId?: string | null): Promise<FinancialAccountRow[]> {
  let q = supabase
    .from('financial_accounts')
    .select(
      'id, name, account_kind, branch_id, opening_balance, current_balance, is_default, is_active, chart_account_id',
    )
    .is('deleted_at', null)
    .order('name', { ascending: true })
  if (branchId) q = q.or(`branch_id.eq.${branchId},branch_id.is.null`)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map((a) => ({
    ...a,
    account_kind: a.account_kind as AccountKind,
    opening_balance: n(a.opening_balance),
    current_balance: n(a.current_balance),
  }))
}

async function upsertAccount(input: {
  id?: string
  organization_id: string
  name: string
  account_kind: AccountKind
  branch_id?: string | null
  opening_balance?: number
  is_default?: boolean
  is_active?: boolean
  chart_account_id?: string | null
}) {
  if (input.id) {
    const { data, error } = await supabase
      .from('financial_accounts')
      .update({
        name: input.name,
        account_kind: input.account_kind,
        branch_id: input.branch_id ?? null,
        opening_balance: input.opening_balance ?? 0,
        is_default: input.is_default ?? false,
        is_active: input.is_active ?? true,
        chart_account_id: input.chart_account_id ?? null,
      })
      .eq('id', input.id)
      .select('id')
      .single()
    if (error) throw error
    return data
  }

  const opening = input.opening_balance ?? 0
  const { data, error } = await supabase
    .from('financial_accounts')
    .insert({
      organization_id: input.organization_id,
      name: input.name,
      account_kind: input.account_kind,
      branch_id: input.branch_id ?? null,
      opening_balance: opening,
      current_balance: opening,
      is_default: input.is_default ?? false,
      is_active: input.is_active ?? true,
      chart_account_id: input.chart_account_id ?? null,
    })
    .select('id')
    .single()
  if (error) throw error
  return data
}

async function setAccountActive(accountId: string, isActive: boolean) {
  const { data, error } = await supabase
    .from('financial_accounts')
    .update({ is_active: isActive })
    .eq('id', accountId)
    .select('id, is_active')
    .single()
  if (error) throw error
  return data
}

function mapFinancialTxn(row: {
  id: string
  account_id: string | null
  direction: string
  amount: number | string
  balance_after?: number | string | null
  transaction_type?: string | null
  transaction_date?: string | null
  note?: string | null
  reference?: string | null
  status?: string | null
  source_type?: string | null
  source_id?: string | null
  financial_accounts?: { name: string } | { name: string }[] | null
}): SimpleTransaction {
  const fa = Array.isArray(row.financial_accounts)
    ? row.financial_accounts[0]
    : row.financial_accounts
  const dateRaw = row.transaction_date ?? ''
  const date = dateRaw.length >= 10 ? dateRaw.slice(0, 10) : dateRaw
  const direction: 'in' | 'out' = row.direction === 'out' ? 'out' : 'in'
  return {
    id: row.id,
    entryId: row.source_id ?? undefined,
    entryNo: row.reference ?? undefined,
    date,
    description: row.note || row.reference || row.transaction_type || 'Transaction',
    accountId: row.account_id,
    accountName: fa?.name ?? null,
    direction,
    amount: n(row.amount),
    category: row.transaction_type ?? null,
    voided: row.status === 'voided',
    sourceType: row.transaction_type ?? row.source_type ?? null,
    balanceAfter: row.balance_after != null ? n(row.balance_after) : null,
  }
}

async function listTransactions(filters: TxnFilters = {}): Promise<SimpleTransaction[]> {
  const limit = filters.limit ?? 100
  let q = db
    .from('financial_transactions')
    .select(
      `
      id, account_id, direction, amount, balance_after,
      transaction_type, transaction_date, note, reference, status,
      source_type, source_id, branch_id,
      financial_accounts ( name )
    `,
    )
    .is('deleted_at', null)
    .order('transaction_date', { ascending: false })
    .limit(limit)

  if (filters.accountId) q = q.eq('account_id', filters.accountId)
  if (filters.branchId) q = q.eq('branch_id', filters.branchId)
  if (filters.from) q = q.gte('transaction_date', `${filters.from}T00:00:00.000Z`)
  if (filters.to) q = q.lte('transaction_date', `${filters.to}T23:59:59.999Z`)
  if (filters.direction && filters.direction !== 'all') {
    q = q.eq('direction', filters.direction)
  }

  const { data, error } = await q
  if (error) throw error

  let rows = ((data ?? []) as Parameters<typeof mapFinancialTxn>[0][]).map(mapFinancialTxn)

  if (filters.search?.trim()) {
    const s = filters.search.trim().toLowerCase()
    rows = rows.filter(
      (r) =>
        r.description.toLowerCase().includes(s) ||
        (r.entryNo ?? '').toLowerCase().includes(s) ||
        (r.accountName ?? '').toLowerCase().includes(s) ||
        (r.category ?? '').toLowerCase().includes(s) ||
        (r.sourceType ?? '').toLowerCase().includes(s),
    )
  }
  return rows
}

async function listAccountTransactions(
  accountId: string,
  filters: TxnFilters = {},
): Promise<SimpleTransaction[]> {
  return listTransactions({ ...filters, accountId })
}

async function lookupTxnIdsBySource(
  sourceType: string,
  sourceIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (!sourceIds.length) return map
  const { data, error } = await db
    .from('financial_transactions')
    .select('id, source_id')
    .eq('source_type', sourceType)
    .in('source_id', sourceIds)
    .eq('status', 'posted')
    .is('deleted_at', null)
  if (error) throw error
  for (const row of data ?? []) {
    if (row.source_id) map.set(row.source_id as string, row.id as string)
  }
  return map
}

async function listIncome(
  filters: DateRange & { branchId?: string | null } = { from: '', to: '' },
): Promise<IncomeExpenseRow[]> {
  const from = filters.from || `${todayIso().slice(0, 7)}-01`
  const to = filters.to || todayIso()
  let q = db
    .from('income_entries')
    .select(
      `
      id, amount, entry_date, note, reference, status, account_id,
      income_categories ( id, name ),
      financial_accounts ( name )
    `,
    )
    .eq('status', 'posted')
    .is('deleted_at', null)
    .gte('entry_date', from)
    .lte('entry_date', to)
    .order('entry_date', { ascending: false })

  if (filters.branchId) q = q.eq('branch_id', filters.branchId)

  const { data, error } = await q
  if (error) throw error

  const rows = data ?? []
  const txnMap = await lookupTxnIdsBySource(
    'income_entry',
    rows.map((r: { id: string }) => r.id),
  )

  return rows.map((row: Record<string, unknown>) => {
    const cat = Array.isArray(row.income_categories)
      ? row.income_categories[0]
      : row.income_categories
    const fa = Array.isArray(row.financial_accounts)
      ? row.financial_accounts[0]
      : row.financial_accounts
    const categoryName =
      cat && typeof cat === 'object' && 'name' in cat ? String((cat as { name: string }).name) : '—'
    const accountName =
      fa && typeof fa === 'object' && 'name' in fa ? String((fa as { name: string }).name) : null
    const id = String(row.id)
    return {
      id,
      entryId: id,
      entryNo: typeof row.reference === 'string' ? row.reference : id.slice(0, 8),
      date: String(row.entry_date),
      category: categoryName,
      description: typeof row.note === 'string' ? row.note : '',
      amount: n(row.amount),
      sourceType: 'income',
      transactionId: txnMap.get(id) ?? null,
      accountName,
    }
  })
}

async function listExpenses(
  filters: DateRange & { branchId?: string | null } = { from: '', to: '' },
): Promise<IncomeExpenseRow[]> {
  const from = filters.from || `${todayIso().slice(0, 7)}-01`
  const to = filters.to || todayIso()
  let q = db
    .from('expense_entries')
    .select(
      `
      id, amount, entry_date, note, reference, status, account_id, payee,
      expense_categories ( id, name ),
      financial_accounts ( name )
    `,
    )
    .eq('status', 'posted')
    .is('deleted_at', null)
    .gte('entry_date', from)
    .lte('entry_date', to)
    .order('entry_date', { ascending: false })

  if (filters.branchId) q = q.eq('branch_id', filters.branchId)

  const { data, error } = await q
  if (error) throw error

  const rows = data ?? []
  const txnMap = await lookupTxnIdsBySource(
    'expense_entry',
    rows.map((r: { id: string }) => r.id),
  )

  return rows.map((row: Record<string, unknown>) => {
    const cat = Array.isArray(row.expense_categories)
      ? row.expense_categories[0]
      : row.expense_categories
    const fa = Array.isArray(row.financial_accounts)
      ? row.financial_accounts[0]
      : row.financial_accounts
    const categoryName =
      cat && typeof cat === 'object' && 'name' in cat ? String((cat as { name: string }).name) : '—'
    const accountName =
      fa && typeof fa === 'object' && 'name' in fa ? String((fa as { name: string }).name) : null
    const id = String(row.id)
    const note = typeof row.note === 'string' ? row.note : ''
    const payee = typeof row.payee === 'string' ? row.payee : ''
    return {
      id,
      entryId: id,
      entryNo: typeof row.reference === 'string' ? row.reference : id.slice(0, 8),
      date: String(row.entry_date),
      category: categoryName,
      description: note || payee,
      amount: n(row.amount),
      sourceType: 'expense',
      transactionId: txnMap.get(id) ?? null,
      accountName,
    }
  })
}

async function listIncomeCategories(orgId: string): Promise<NamedCategory[]> {
  const { data, error } = await db
    .from('income_categories')
    .select('id, name')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))
}

async function listExpenseCategories(orgId: string): Promise<NamedCategory[]> {
  const { data, error } = await db
    .from('expense_categories')
    .select('id, name')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))
}

async function createIncome(payload: {
  amount: number
  account_id: string
  category_id: string
  branch_id: string
  note?: string
  entry_date?: string
  reference?: string
  client_txn_key?: string
}) {
  const { data, error } = await supabase.rpc('create_income', {
    payload: {
      amount: payload.amount,
      account_id: payload.account_id,
      category_id: payload.category_id,
      branch_id: payload.branch_id,
      note: payload.note ?? null,
      entry_date: payload.entry_date ?? null,
      reference: payload.reference ?? null,
      client_txn_key: payload.client_txn_key ?? null,
    } as unknown as Json,
  })
  if (error) throw error
  return data
}

async function createExpense(payload: {
  amount: number
  account_id: string
  category_id: string
  branch_id: string
  note?: string
  entry_date?: string
  reference?: string
  payee?: string
  client_txn_key?: string
}) {
  const { data, error } = await supabase.rpc('create_expense', {
    payload: {
      amount: payload.amount,
      account_id: payload.account_id,
      category_id: payload.category_id,
      branch_id: payload.branch_id,
      note: payload.note ?? null,
      entry_date: payload.entry_date ?? null,
      reference: payload.reference ?? null,
      payee: payload.payee ?? null,
      client_txn_key: payload.client_txn_key ?? null,
    } as unknown as Json,
  })
  if (error) throw error
  return data
}

async function transferBalance(payload: {
  from_account_id: string
  to_account_id: string
  amount: number
  description?: string
  entry_date?: string
  branch_id?: string | null
  note?: string
  transfer_date?: string
  client_txn_key?: string
}) {
  const { data, error } = await supabase.rpc('transfer_account_balance', {
    payload: {
      from_account_id: payload.from_account_id,
      to_account_id: payload.to_account_id,
      amount: payload.amount,
      note: payload.note ?? payload.description ?? null,
      transfer_date: payload.transfer_date ?? payload.entry_date ?? null,
      branch_id: payload.branch_id ?? null,
      client_txn_key: payload.client_txn_key ?? null,
    } as unknown as Json,
  })
  if (error) throw error
  return data
}

async function closeBusinessDay(payload: {
  business_date: string
  counted_cash: number
  expected_cash?: number
  notes?: string
  branch_id?: string | null
  financial_account_id?: string | null
  difference_reason?: string
}) {
  const difference =
    payload.expected_cash != null ? payload.counted_cash - payload.expected_cash : 0
  const { data, error } = await supabase.rpc('close_business_day', {
    payload: {
      closing_date: payload.business_date,
      counted_cash: payload.counted_cash,
      expected_closing: payload.expected_cash,
      note: payload.notes,
      branch_id: payload.branch_id,
      difference_reason:
        payload.difference_reason ?? (Math.abs(difference) > 0.01 ? 'Variance noted' : null),
    } as unknown as Json,
  })
  if (error) throw error
  return data
}

async function voidTransaction(payload: { transaction_id: string; reason?: string }) {
  const { data, error } = await supabase.rpc('void_financial_transaction', {
    txn_id: payload.transaction_id,
    reason: payload.reason ?? 'Voided by user',
  })
  if (error) throw error
  return data
}

async function sumCompletedSales(
  from: string,
  to: string,
  branchId?: string | null,
): Promise<{ total: number; ids: string[] }> {
  const { start } = dayBounds(from)
  const { end } = dayBounds(to)
  let q = supabase
    .from('sales')
    .select('id, grand_total')
    .eq('status', 'completed')
    .is('deleted_at', null)
    .gte('completed_at', start)
    .lte('completed_at', end)
  if (branchId) q = q.eq('branch_id', branchId)
  const { data, error } = await q
  if (error) throw error
  const ids = (data ?? []).map((s) => s.id)
  const total = (data ?? []).reduce((s, r) => s + n(r.grand_total), 0)
  return { total, ids }
}

async function sumSaleReturns(from: string, to: string, branchId?: string | null) {
  const { start } = dayBounds(from)
  const { end } = dayBounds(to)
  let q = supabase
    .from('sale_returns')
    .select('total')
    .in('status', ['approved', 'completed'])
    .is('deleted_at', null)
    .gte('created_at', start)
    .lte('created_at', end)
  if (branchId) q = q.eq('branch_id', branchId)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).reduce((s, r) => s + n(r.total), 0)
}

async function sumSaleItemsCost(saleIds: string[]) {
  if (!saleIds.length) return 0
  const chunkSize = 200
  let total = 0
  for (let i = 0; i < saleIds.length; i += chunkSize) {
    const chunk = saleIds.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from('sale_items')
      .select('cost_price, qty')
      .in('sale_id', chunk)
      .is('deleted_at', null)
    if (error) throw error
    total += (data ?? []).reduce((s, r) => s + n(r.cost_price) * n(r.qty), 0)
  }
  return total
}

async function sumIncomeEntries(from: string, to: string, branchId?: string | null) {
  let q = db
    .from('income_entries')
    .select('amount')
    .eq('status', 'posted')
    .is('deleted_at', null)
    .gte('entry_date', from)
    .lte('entry_date', to)
  if (branchId) q = q.eq('branch_id', branchId)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).reduce((s: number, r: { amount: number }) => s + n(r.amount), 0)
}

async function sumExpenseEntries(from: string, to: string, branchId?: string | null) {
  let q = db
    .from('expense_entries')
    .select('amount')
    .eq('status', 'posted')
    .is('deleted_at', null)
    .gte('entry_date', from)
    .lte('entry_date', to)
  if (branchId) q = q.eq('branch_id', branchId)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).reduce((s: number, r: { amount: number }) => s + n(r.amount), 0)
}

async function sumSupplierDue(): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('suppliers')
      .select('current_due')
      .is('deleted_at', null)
      .gt('current_due', 0)
    if (error) throw error
    return (data ?? []).reduce((s, r) => s + n(r.current_due), 0)
  } catch {
    try {
      const { data, error } = await supabase
        .from('supplier_ledger')
        .select('debit, credit')
        .is('deleted_at', null)
      if (error) throw error
      return (data ?? []).reduce((s, r) => s + (n(r.debit) - n(r.credit)), 0)
    } catch {
      return 0
    }
  }
}

async function getProfitLoss(
  fromOrOpts: string | { from: string; to: string; branchId?: string | null },
  toArg?: string,
  branchIdArg?: string | null,
): Promise<ProfitLossResult> {
  const from = typeof fromOrOpts === 'string' ? fromOrOpts : fromOrOpts.from
  const to = typeof fromOrOpts === 'string' ? (toArg ?? todayIso()) : fromOrOpts.to
  const branchId =
    typeof fromOrOpts === 'string' ? branchIdArg : (fromOrOpts.branchId ?? null)

  const [sales, returns, otherIncome, expenses] = await Promise.all([
    sumCompletedSales(from, to, branchId),
    sumSaleReturns(from, to, branchId),
    sumIncomeEntries(from, to, branchId),
    sumExpenseEntries(from, to, branchId),
  ])

  const productCost = await sumSaleItemsCost(sales.ids)
  const netSales = sales.total - returns
  const grossProfit = netSales - productCost
  const netProfit = grossProfit + otherIncome - expenses
  const margin = netSales > 0 ? (netProfit / netSales) * 100 : 0

  return {
    netSales,
    productCost,
    grossProfit,
    otherIncome,
    expenses,
    netProfit,
    margin,
    gross: grossProfit + otherIncome,
    from,
    to,
  }
}

async function getDashboardKpis(branchId?: string | null, date?: string): Promise<DashboardKpis> {
  const day = date ?? todayIso()
  const monthStart = `${day.slice(0, 7)}-01`
  const { start: dayStart, end: dayEnd } = dayBounds(day)

  const [accounts, customers, supplierDue, recentTxns, monthPl, todaySalesBundle, todayExpenses] =
    await Promise.all([
      listFinancialAccounts(branchId),
      supabase
        .from('customers')
        .select('current_due')
        .is('deleted_at', null)
        .gt('current_due', 0),
      sumSupplierDue(),
      listTransactions({ from: day, to: day, branchId, limit: 12 }),
      getProfitLoss({ from: monthStart, to: day, branchId }),
      sumCompletedSales(day, day, branchId),
      sumExpenseEntries(day, day, branchId),
    ])

  if (customers.error) throw customers.error

  const active = accounts.filter((a) => a.is_active)
  const sumKind = (kind: AccountKind) =>
    active.filter((a) => a.account_kind === kind).reduce((s, a) => s + n(a.current_balance), 0)

  const cashOnly = sumKind('cash')
  const bankBalance = sumKind('bank')
  const mobileBalance = sumKind('mobile_money')
  /** Liquidity across cash / bank / mobile (legacy KPI name). */
  const cashBalance = cashOnly + bankBalance + mobileBalance

  const customerDue = (customers.data ?? []).reduce((s, c) => s + n(c.current_due), 0)

  // Collections today: txn type/source mentions collection, direction in
  let collectQ = db
    .from('financial_transactions')
    .select('amount, transaction_type, source_type, direction')
    .eq('direction', 'in')
    .eq('status', 'posted')
    .is('deleted_at', null)
    .gte('transaction_date', dayStart)
    .lte('transaction_date', dayEnd)
  if (branchId) collectQ = collectQ.eq('branch_id', branchId)
  const { data: collectRows, error: collectErr } = await collectQ
  if (collectErr) throw collectErr
  const todayCollection = (collectRows ?? [])
    .filter((r: { transaction_type?: string | null; source_type?: string | null }) => {
      const blob = `${r.transaction_type ?? ''} ${r.source_type ?? ''}`.toLowerCase()
      return blob.includes('collection') || blob.includes('customer_due') || blob.includes('due')
    })
    .reduce((s: number, r: { amount: number }) => s + n(r.amount), 0)

  const todayCogs = await sumSaleItemsCost(todaySalesBundle.ids)
  const todayProfit = todaySalesBundle.total - todayCogs - todayExpenses

  const monthTxns = await listTransactions({ from: monthStart, to: day, branchId, limit: 500 })
  const moneyIn = monthTxns.filter((t) => t.direction === 'in' && !t.voided).reduce((s, t) => s + t.amount, 0)
  const moneyOut = monthTxns.filter((t) => t.direction === 'out' && !t.voided).reduce((s, t) => s + t.amount, 0)

  return {
    cashBalance,
    /** Cash drawer / till only — used by dashboard “Cash” card */
    cashDrawerBalance: cashOnly,
    bankBalance,
    mobileBalance,
    moneyIn,
    moneyOut,
    customerDue,
    supplierDue,
    netProfit: monthPl.netProfit,
    todaySales: todaySalesBundle.total,
    todayCollection,
    todayExpenses,
    todayProfit,
    monthProfit: monthPl.netProfit,
    recent: recentTxns,
    recentTxns,
  }
}

async function listCustomerDues(limit = 100) {
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, phone, current_due')
    .is('deleted_at', null)
    .gt('current_due', 0)
    .order('current_due', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    due: n(c.current_due),
  }))
}

async function listSupplierDues(limit = 100) {
  try {
    const { data, error } = await supabase
      .from('suppliers')
      .select('id, name, phone, current_due')
      .is('deleted_at', null)
      .gt('current_due', 0)
      .order('current_due', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      phone: s.phone,
      due: n(s.current_due),
    }))
  } catch {
    return []
  }
}

function newClientTxnKey() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `txn-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

async function collectCustomerDue(payload: {
  customer_id: string
  amount: number
  payment_method: string
  financial_account_id?: string | null
  branch_id?: string | null
  note?: string | null
  reference?: string | null
}) {
  if (!payload.branch_id) throw new Error('Select an active branch first')
  if (!payload.financial_account_id) throw new Error('Select a receive account')
  const { data, error } = await supabase.rpc('collect_customer_due', {
    payload: {
      customer_id: payload.customer_id,
      branch_id: payload.branch_id,
      amount: payload.amount,
      note: payload.note ?? null,
      client_txn_key: newClientTxnKey(),
      payments: [
        {
          method: payload.payment_method,
          amount: payload.amount,
          financial_account_id: payload.financial_account_id,
          reference: payload.reference ?? null,
        },
      ],
    } as unknown as Json,
  })
  if (error) throw error
  return data
}

/** Alias kept for callers expecting collectDue */
const collectDue = collectCustomerDue

async function paySupplier(payload: {
  supplier_id: string
  amount: number
  method: string
  financial_account_id?: string | null
  branch_id?: string | null
  reference?: string | null
  note?: string | null
  purchase_id?: string | null
}) {
  if (!payload.branch_id) throw new Error('Select an active branch first')
  if (!payload.financial_account_id) throw new Error('Select a payment account')
  const { data, error } = await supabase.rpc('pay_supplier', {
    payload: {
      supplier_id: payload.supplier_id,
      amount: payload.amount,
      branch_id: payload.branch_id,
      purchase_id: payload.purchase_id ?? null,
      note: payload.note ?? null,
      client_txn_key: newClientTxnKey(),
      payments: [
        {
          method: payload.method,
          amount: payload.amount,
          financial_account_id: payload.financial_account_id,
          reference: payload.reference ?? null,
        },
      ],
    } as unknown as Json,
  })
  if (error) throw error
  return data
}

async function getAccountSettings(organizationId: string): Promise<AccountSettings> {
  const blob = await getOrgSettingsBlob(organizationId)
  const acct = asRecord(blob[SETTINGS_KEY])
  return {
    incomeCategories: stringArray(acct.income_categories, DEFAULT_INCOME_CATEGORIES),
    expenseCategories: stringArray(acct.expense_categories, DEFAULT_EXPENSE_CATEGORIES),
    defaultCashAccountId:
      typeof acct.default_cash_account_id === 'string' ? acct.default_cash_account_id : null,
    defaultBankAccountId:
      typeof acct.default_bank_account_id === 'string' ? acct.default_bank_account_id : null,
    defaultPurchasePaymentAccountId:
      typeof acct.default_purchase_payment_account_id === 'string'
        ? acct.default_purchase_payment_account_id
        : null,
    allowNegativeBalance: Boolean(acct.allow_negative_balance),
    requireDailyClosing: Boolean(acct.require_daily_closing),
    expenseApprovalLimit: n(acct.expense_approval_limit),
    allowCustomerAdvance: Boolean(acct.allow_customer_advance),
    allowSupplierAdvance: Boolean(acct.allow_supplier_advance),
  }
}

async function syncCategoryRows(
  table: 'income_categories' | 'expense_categories',
  organizationId: string,
  names: string[],
) {
  const existing = await db
    .from(table)
    .select('id, name')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
  if (existing.error) throw existing.error

  const want = new Set(names.map((n) => n.trim()).filter(Boolean))
  const have = new Map<string, string>(
    (existing.data ?? []).map((r: { id: string; name: string }) => [r.name.toLowerCase(), r.id]),
  )

  for (const name of want) {
    if (!have.has(name.toLowerCase())) {
      const { error } = await db.from(table).insert({
        organization_id: organizationId,
        name,
        is_active: true,
      })
      if (error) throw error
    }
  }
}

async function saveAccountSettings(organizationId: string, next: AccountSettings) {
  const blob = await getOrgSettingsBlob(organizationId)
  const merged = {
    ...blob,
    [SETTINGS_KEY]: {
      income_categories: next.incomeCategories,
      expense_categories: next.expenseCategories,
      default_cash_account_id: next.defaultCashAccountId,
      default_bank_account_id: next.defaultBankAccountId,
      default_purchase_payment_account_id: next.defaultPurchasePaymentAccountId,
      allow_negative_balance: next.allowNegativeBalance,
      require_daily_closing: next.requireDailyClosing,
      expense_approval_limit: next.expenseApprovalLimit,
      allow_customer_advance: next.allowCustomerAdvance,
      allow_supplier_advance: next.allowSupplierAdvance,
    },
  }
  const { error } = await supabase
    .from('organizations')
    .update({ settings: merged as Json })
    .eq('id', organizationId)
  if (error) throw error

  await Promise.all([
    syncCategoryRows('income_categories', organizationId, next.incomeCategories),
    syncCategoryRows('expense_categories', organizationId, next.expenseCategories),
  ])
  return next
}

async function getExpectedCash(branchId?: string | null, accountId?: string | null) {
  const accounts = await listFinancialAccounts(branchId)
  const cashAccounts = accounts.filter(
    (a) => a.is_active && (accountId ? a.id === accountId : a.account_kind === 'cash'),
  )
  return cashAccounts.reduce((s, a) => s + n(a.current_balance), 0)
}

export const simpleAccountingRepository = {
  getDashboardKpis,
  listFinancialAccounts,
  upsertAccount,
  setAccountActive,
  listAccountTransactions,
  createIncome,
  createExpense,
  transferBalance,
  closeBusinessDay,
  voidTransaction,
  listIncome,
  listExpenses,
  listTransactions,
  listCustomerDues,
  listSupplierDues,
  collectCustomerDue,
  collectDue,
  paySupplier,
  getProfitLoss,
  listIncomeCategories,
  listExpenseCategories,
  getAccountSettings,
  saveAccountSettings,
  getExpectedCash,
}
