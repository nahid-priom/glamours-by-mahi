import { supabase } from '@/lib/supabase/client'
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database'
import type { EntityOption } from '@/components/entity-combobox'

export type Supplier = Tables<'suppliers'>
export type SupplierLedgerRow = Tables<'supplier_ledger'>

export type SupplierFilters = {
  search?: string
  status?: string | null
  /** When true, only suppliers with current_due > 0 */
  dueOnly?: boolean
  page?: number
  pageSize?: number
}

export type SupplierInput = {
  name: string
  phone?: string | null
  email?: string | null
  address?: string | null
  barcode?: string | null
  notes?: string | null
  status?: 'active' | 'inactive'
  branch_id?: string | null
}

export type SupplierListItem = Supplier

export type SupplierLedgerEntry = SupplierLedgerRow

function range(page: number, pageSize: number) {
  const from = (page - 1) * pageSize
  return { from, to: from + pageSize - 1 }
}

export async function listSuppliers(
  filters: SupplierFilters = {},
): Promise<{ items: SupplierListItem[]; total: number }> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 50
  const { from, to } = range(page, pageSize)
  const q = filters.search?.trim()

  let builder = supabase
    .from('suppliers')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .range(from, to)

  if (q) builder = builder.or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
  if (filters.status) {
    builder = builder.eq('status', filters.status as 'active' | 'inactive')
  }
  if (filters.dueOnly) {
    builder = builder.gt('current_due', 0)
  }

  const { data, error, count } = await builder
  if (error) throw error
  return { items: data ?? [], total: count ?? 0 }
}

export async function searchSuppliers(query: string): Promise<EntityOption[]> {
  const q = query.trim()
  let builder = supabase
    .from('suppliers')
    .select('id, name, phone, current_due')
    .is('deleted_at', null)
    .neq('status', 'inactive')
    .order('name', { ascending: true })
    .limit(20)
  if (q) builder = builder.or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
  const { data, error } = await builder
  if (error) throw error
  return (data ?? []).map((s) => ({
    id: s.id,
    label: s.name,
    description: s.phone
      ? `${s.phone} · due ৳${Number(s.current_due).toFixed(0)}`
      : `due ৳${Number(s.current_due).toFixed(0)}`,
  }))
}

export async function getSupplier(id: string): Promise<Supplier | null> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createSupplier(
  organizationId: string,
  input: SupplierInput,
): Promise<Supplier> {
  const payload: TablesInsert<'suppliers'> = {
    organization_id: organizationId,
    name: input.name.trim(),
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    address: input.address?.trim() || null,
    barcode: input.barcode?.trim() || null,
    notes: input.notes?.trim() || null,
    status: input.status ?? 'active',
    branch_id: input.branch_id ?? null,
  }
  const { data, error } = await supabase.from('suppliers').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function updateSupplier(id: string, input: Partial<SupplierInput>): Promise<Supplier> {
  const payload: TablesUpdate<'suppliers'> = {}
  if (input.name !== undefined) payload.name = input.name.trim()
  if (input.phone !== undefined) payload.phone = input.phone?.trim() || null
  if (input.email !== undefined) payload.email = input.email?.trim() || null
  if (input.address !== undefined) payload.address = input.address?.trim() || null
  if (input.barcode !== undefined) payload.barcode = input.barcode?.trim() || null
  if (input.notes !== undefined) payload.notes = input.notes?.trim() || null
  if (input.status !== undefined) payload.status = input.status
  if (input.branch_id !== undefined) payload.branch_id = input.branch_id

  const { data, error } = await supabase
    .from('suppliers')
    .update(payload)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function softDeleteSupplier(id: string): Promise<void> {
  const { error } = await supabase
    .from('suppliers')
    .update({ deleted_at: new Date().toISOString(), status: 'inactive' })
    .eq('id', id)
    .is('deleted_at', null)
  if (error) throw error
}

export async function listSupplierLedger(
  supplierId: string,
  limit = 100,
): Promise<SupplierLedgerEntry[]> {
  const { data, error } = await supabase
    .from('supplier_ledger')
    .select('*')
    .eq('supplier_id', supplierId)
    .is('deleted_at', null)
    .order('occurred_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

/** Payment entries from supplier_ledger. */
export async function listSupplierPayments(
  supplierId?: string | null,
  limit = 100,
): Promise<SupplierLedgerEntry[]> {
  let builder = supabase
    .from('supplier_ledger')
    .select('*')
    .is('deleted_at', null)
    .eq('entry_type', 'payment')
    .order('occurred_at', { ascending: false })
    .limit(limit)
  if (supplierId) builder = builder.eq('supplier_id', supplierId)
  const { data, error } = await builder
  if (error) throw error
  return data ?? []
}

export const suppliersRepository = {
  listSuppliers,
  searchSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  softDeleteSupplier,
  listSupplierLedger,
  listSupplierPayments,
}
