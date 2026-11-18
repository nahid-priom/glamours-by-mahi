import { supabase } from '@/lib/supabase/client'
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database'
import type { EntityOption } from '@/components/entity-combobox'

export type Customer = Tables<'customers'>
export type CustomerLedgerRow = Tables<'customer_ledger'>

export type CustomerFilters = {
  search?: string
  status?: string | null
  /** When true, only customers with current_due > 0 */
  dueOnly?: boolean
  page?: number
  pageSize?: number
}

export type CustomerInput = {
  name: string
  phone: string
  email?: string | null
  address?: string | null
  district?: string | null
  barcode?: string | null
  preferred_channel?: string | null
  notes?: string | null
  status?: 'active' | 'blocked' | 'archived'
  branch_id?: string | null
}

function range(page: number, pageSize: number) {
  const from = (page - 1) * pageSize
  return { from, to: from + pageSize - 1 }
}

export async function listCustomers(
  filters: CustomerFilters = {},
): Promise<{ items: Customer[]; total: number }> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 50
  const { from, to } = range(page, pageSize)
  const q = filters.search?.trim()

  let builder = supabase
    .from('customers')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .range(from, to)

  if (q) {
    builder = builder.or(
      `name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,district.ilike.%${q}%`,
    )
  }
  if (filters.status) {
    builder = builder.eq('status', filters.status as 'active' | 'blocked' | 'archived')
  }
  if (filters.dueOnly) {
    builder = builder.gt('current_due', 0)
  }

  const { data, error, count } = await builder
  if (error) throw error
  return { items: data ?? [], total: count ?? 0 }
}

export async function searchCustomers(query: string): Promise<EntityOption[]> {
  const q = query.trim()
  let builder = supabase
    .from('customers')
    .select('id, name, phone, current_due')
    .is('deleted_at', null)
    .neq('status', 'archived')
    .order('name', { ascending: true })
    .limit(20)
  if (q) builder = builder.or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
  const { data, error } = await builder
  if (error) throw error
  return (data ?? []).map((c) => ({
    id: c.id,
    label: c.name,
    description: c.phone
      ? `${c.phone} · due ৳${Number(c.current_due).toFixed(0)}`
      : `due ৳${Number(c.current_due).toFixed(0)}`,
  }))
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createCustomer(
  organizationId: string,
  input: CustomerInput,
): Promise<Customer> {
  const payload: TablesInsert<'customers'> = {
    organization_id: organizationId,
    name: input.name.trim(),
    phone: input.phone.trim(),
    email: input.email?.trim() || null,
    address: input.address?.trim() || null,
    district: input.district?.trim() || null,
    barcode: input.barcode?.trim() || null,
    preferred_channel: input.preferred_channel?.trim() || null,
    notes: input.notes?.trim() || null,
    status: input.status ?? 'active',
    branch_id: input.branch_id ?? null,
  }
  const { data, error } = await supabase.from('customers').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function updateCustomer(id: string, input: Partial<CustomerInput>): Promise<Customer> {
  const payload: TablesUpdate<'customers'> = {}
  if (input.name !== undefined) payload.name = input.name.trim()
  if (input.phone !== undefined) payload.phone = input.phone.trim()
  if (input.email !== undefined) payload.email = input.email?.trim() || null
  if (input.address !== undefined) payload.address = input.address?.trim() || null
  if (input.district !== undefined) payload.district = input.district?.trim() || null
  if (input.barcode !== undefined) payload.barcode = input.barcode?.trim() || null
  if (input.preferred_channel !== undefined) {
    payload.preferred_channel = input.preferred_channel?.trim() || null
  }
  if (input.notes !== undefined) payload.notes = input.notes?.trim() || null
  if (input.status !== undefined) payload.status = input.status
  if (input.branch_id !== undefined) payload.branch_id = input.branch_id

  const { data, error } = await supabase
    .from('customers')
    .update(payload)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function softDeleteCustomer(id: string): Promise<void> {
  const { error } = await supabase
    .from('customers')
    .update({ deleted_at: new Date().toISOString(), status: 'archived' })
    .eq('id', id)
    .is('deleted_at', null)
  if (error) throw error
}

export async function listCustomerLedger(
  customerId: string,
  limit = 100,
): Promise<CustomerLedgerRow[]> {
  const { data, error } = await supabase
    .from('customer_ledger')
    .select('*')
    .eq('customer_id', customerId)
    .is('deleted_at', null)
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

/** Collection / payment credits that reduce AR (canonical + at-sale). */
export const CUSTOMER_COLLECTION_ENTRY_TYPES = ['collection', 'sale_payment'] as const

export const CUSTOMER_SALE_ENTRY_TYPES = ['sale_invoice', 'sale_due', 'opening'] as const

/** Collection entries from customer_ledger. */
export async function listCustomerCollections(
  customerId?: string | null,
  limit = 100,
): Promise<CustomerLedgerRow[]> {
  let builder = supabase
    .from('customer_ledger')
    .select('*')
    .is('deleted_at', null)
    .in('entry_type', [...CUSTOMER_COLLECTION_ENTRY_TYPES])
    .gt('credit', 0)
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)
  if (customerId) builder = builder.eq('customer_id', customerId)
  const { data, error } = await builder
  if (error) throw error
  return data ?? []
}

export type CustomerLedgerStatement = {
  customer_id: string
  opening_balance: number
  total_sales: number
  total_collections: number
  total_returns: number
  total_adjustments: number
  closing_due: number
  page: number
  page_size: number
  total_count: number
  lines: Array<{
    id: string
    occurred_at: string
    branch_id: string | null
    entry_type: string
    reference_type: string | null
    reference_id: string | null
    notes: string | null
    due_increase: number
    due_decrease: number
    running_balance: number
  }>
}

export async function getCustomerLedgerStatement(params: {
  customerId: string
  from?: string | null
  to?: string | null
  branchId?: string | null
  entryTypes?: string[] | null
  search?: string | null
  page?: number
  pageSize?: number
}): Promise<CustomerLedgerStatement> {
  const { data, error } = await (supabase as unknown as {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: Error | null }>
  }).rpc('get_customer_ledger_statement', {
    p_customer_id: params.customerId,
    p_from: params.from ?? null,
    p_to: params.to ?? null,
    p_branch_id: params.branchId ?? null,
    p_entry_types: params.entryTypes ?? null,
    p_search: params.search?.trim() || null,
    p_page: params.page ?? 1,
    p_page_size: params.pageSize ?? 50,
  })
  if (error) throw error
  const raw = (data ?? {}) as Record<string, unknown>
  const lines = Array.isArray(raw.lines) ? raw.lines : []
  return {
    customer_id: String(raw.customer_id ?? params.customerId),
    opening_balance: Number(raw.opening_balance ?? 0),
    total_sales: Number(raw.total_sales ?? 0),
    total_collections: Number(raw.total_collections ?? 0),
    total_returns: Number(raw.total_returns ?? 0),
    total_adjustments: Number(raw.total_adjustments ?? 0),
    closing_due: Number(raw.closing_due ?? 0),
    page: Number(raw.page ?? 1),
    page_size: Number(raw.page_size ?? 50),
    total_count: Number(raw.total_count ?? 0),
    lines: lines.map((row) => {
      const r = row as Record<string, unknown>
      return {
        id: String(r.id),
        occurred_at: String(r.occurred_at),
        branch_id: (r.branch_id as string | null) ?? null,
        entry_type: String(r.entry_type ?? ''),
        reference_type: (r.reference_type as string | null) ?? null,
        reference_id: (r.reference_id as string | null) ?? null,
        notes: (r.notes as string | null) ?? null,
        due_increase: Number(r.due_increase ?? 0),
        due_decrease: Number(r.due_decrease ?? 0),
        running_balance: Number(r.running_balance ?? 0),
      }
    }),
  }
}

export type CustomerSaleSummary = {
  id: string
  invoice_no: string
  created_at: string
  status: string
  payment_status: string
  grand_total: number
  due_total: number
}

export async function listCustomerSales(
  customerId: string,
  limit = 20,
): Promise<CustomerSaleSummary[]> {
  const { data, error } = await supabase
    .from('sales')
    .select('id, invoice_no, created_at, status, payment_status, grand_total, due_total')
    .eq('customer_id', customerId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id,
    invoice_no: row.invoice_no,
    created_at: row.created_at,
    status: row.status,
    payment_status: row.payment_status,
    grand_total: Number(row.grand_total ?? 0),
    due_total: Number(row.due_total ?? 0),
  }))
}

export const customersRepository = {
  listCustomers,
  searchCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  softDeleteCustomer,
  listCustomerLedger,
  listCustomerCollections,
  getCustomerLedgerStatement,
  listCustomerSales,
}
