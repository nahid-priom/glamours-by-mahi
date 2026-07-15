import { supabase } from '@/lib/supabase/client'
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database'
import type { EntityOption } from '@/components/entity-combobox'

export type Customer = Tables<'customers'>
export type CustomerLedgerRow = Tables<'customer_ledger'>

export type CustomerFilters = {
  search?: string
  status?: string | null
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
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export const customersRepository = {
  listCustomers,
  searchCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  softDeleteCustomer,
  listCustomerLedger,
}
