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
  code?: string | null
  business_type?: string | null
  contact_person?: string | null
  vat_reg_no?: string | null
  payment_terms_days?: number | null
  credit_limit?: number | null
  established_year?: number | null
}

export type SupplierDocumentRow = {
  id: string
  supplier_id: string
  file_name: string
  file_path: string
  mime_type: string | null
  file_size: number | null
  created_at: string
}

export type SupplierPurchaseSummary = {
  id: string
  invoice_no: string
  completed_at: string | null
  status: string
  payment_status: string
  grand_total: number
  due_total: number
  created_at: string
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
  const payload: TablesUpdate<'suppliers'> & Record<string, unknown> = {}
  if (input.name !== undefined) payload.name = input.name.trim()
  if (input.phone !== undefined) payload.phone = input.phone?.trim() || null
  if (input.email !== undefined) payload.email = input.email?.trim() || null
  if (input.address !== undefined) payload.address = input.address?.trim() || null
  if (input.barcode !== undefined) payload.barcode = input.barcode?.trim() || null
  if (input.notes !== undefined) payload.notes = input.notes?.trim() || null
  if (input.status !== undefined) payload.status = input.status
  if (input.branch_id !== undefined) payload.branch_id = input.branch_id
  if (input.code !== undefined) payload.code = input.code?.trim() || null
  if (input.business_type !== undefined) payload.business_type = input.business_type?.trim() || null
  if (input.contact_person !== undefined) payload.contact_person = input.contact_person?.trim() || null
  if (input.vat_reg_no !== undefined) payload.vat_reg_no = input.vat_reg_no?.trim() || null
  if (input.payment_terms_days !== undefined) payload.payment_terms_days = input.payment_terms_days
  if (input.credit_limit !== undefined) payload.credit_limit = input.credit_limit
  if (input.established_year !== undefined) payload.established_year = input.established_year

  const { data, error } = await supabase
    .from('suppliers')
    .update(payload as TablesUpdate<'suppliers'>)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listSupplierDocuments(supplierId: string): Promise<SupplierDocumentRow[]> {
  const { data, error } = await (supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          is: (
            col: string,
            val: null,
          ) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => Promise<{ data: SupplierDocumentRow[] | null; error: Error | null }>
          }
        }
      }
    }
  })
    .from('supplier_documents')
    .select('id, supplier_id, file_name, file_path, mime_type, file_size, created_at')
    .eq('supplier_id', supplierId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function uploadSupplierDocument(
  supplierId: string,
  organizationId: string,
  file: File,
): Promise<SupplierDocumentRow> {
  const safeName = file.name.replace(/[^\w.\-()+ ]/g, '_')
  const filePath = `${organizationId}/${supplierId}/${Date.now()}-${safeName}`
  const { error: uploadError } = await supabase.storage
    .from('supplier-documents')
    .upload(filePath, file, { upsert: false })
  if (uploadError) throw uploadError

  const { data, error } = await (supabase as unknown as {
    from: (table: string) => {
      insert: (row: Record<string, unknown>) => {
        select: () => {
          single: () => Promise<{ data: SupplierDocumentRow; error: Error | null }>
        }
      }
    }
  })
    .from('supplier_documents')
    .insert({
      supplier_id: supplierId,
      organization_id: organizationId,
      file_name: file.name,
      file_path: filePath,
      mime_type: file.type || null,
      file_size: file.size,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteSupplierDocument(documentId: string, filePath: string): Promise<void> {
  const { error: storageError } = await supabase.storage.from('supplier-documents').remove([filePath])
  if (storageError) throw storageError
  const { error } = await (supabase as unknown as {
    from: (table: string) => {
      update: (row: Record<string, unknown>) => {
        eq: (col: string, val: string) => Promise<{ error: Error | null }>
      }
    }
  })
    .from('supplier_documents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', documentId)
  if (error) throw error
}

export async function listSupplierPurchases(
  supplierId: string,
  limit = 20,
): Promise<SupplierPurchaseSummary[]> {
  const { data, error } = await supabase
    .from('purchases')
    .select(
      'id, invoice_no, completed_at, status, payment_status, grand_total, due_total, created_at',
    )
    .eq('supplier_id', supplierId)
    .is('deleted_at', null)
    .order('completed_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id,
    invoice_no: row.invoice_no,
    completed_at: row.completed_at,
    status: row.status,
    payment_status: row.payment_status,
    grand_total: Number(row.grand_total ?? 0),
    due_total: Number(row.due_total ?? 0),
    created_at: row.created_at,
  }))
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
    .order('id', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

/** Payment / credit entries that reduce AP (canonical + legacy types). */
export const SUPPLIER_PAYMENT_ENTRY_TYPES = [
  'supplier_payment',
  'purchase_payment',
  'payment',
] as const

export const SUPPLIER_PURCHASE_ENTRY_TYPES = [
  'purchase_invoice',
  'purchase_due',
  'opening',
] as const

/** Payment entries from supplier_ledger (all live posting types). */
export async function listSupplierPayments(
  supplierId?: string | null,
  limit = 100,
): Promise<SupplierLedgerEntry[]> {
  let builder = supabase
    .from('supplier_ledger')
    .select('*')
    .is('deleted_at', null)
    .in('entry_type', [...SUPPLIER_PAYMENT_ENTRY_TYPES])
    .gt('credit', 0)
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)
  if (supplierId) builder = builder.eq('supplier_id', supplierId)
  const { data, error } = await builder
  if (error) throw error
  return data ?? []
}

export type SupplierLedgerStatement = {
  supplier_id: string
  opening_balance: number
  total_purchases: number
  total_payments: number
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

export async function getSupplierLedgerStatement(params: {
  supplierId: string
  from?: string | null
  to?: string | null
  branchId?: string | null
  entryTypes?: string[] | null
  search?: string | null
  page?: number
  pageSize?: number
}): Promise<SupplierLedgerStatement> {
  const { data, error } = await (supabase as unknown as {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: Error | null }>
  }).rpc('get_supplier_ledger_statement', {
    p_supplier_id: params.supplierId,
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
    supplier_id: String(raw.supplier_id ?? params.supplierId),
    opening_balance: Number(raw.opening_balance ?? 0),
    total_purchases: Number(raw.total_purchases ?? 0),
    total_payments: Number(raw.total_payments ?? 0),
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

export type SupplierDirectorySummary = {
  total_suppliers: number
  total_purchases: number
  total_payments: number
  current_due: number
  total_items_in_stock: number
  stock_unit_label: string
}

export type SupplierDirectoryCard = Supplier & {
  total_paid: number
  total_purchased: number
  stock_on_hand: number | null
  units_sold: number | null
  last_activity_at: string | null
}

export async function getSupplierDirectorySummary(params?: {
  branchId?: string | null
}): Promise<SupplierDirectorySummary> {
  const { data, error } = await (supabase as unknown as {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: Error | null }>
  }).rpc('get_supplier_directory_summary', {
    p_branch_id: params?.branchId ?? null,
  })
  if (error) throw error
  const raw = (data ?? {}) as Record<string, unknown>
  return {
    total_suppliers: Number(raw.total_suppliers ?? 0),
    total_purchases: Number(raw.total_purchases ?? 0),
    total_payments: Number(raw.total_payments ?? 0),
    current_due: Number(raw.current_due ?? 0),
    total_items_in_stock: Number(raw.total_items_in_stock ?? 0),
    stock_unit_label: String(raw.stock_unit_label ?? 'pcs'),
  }
}

export async function listSupplierDirectoryCards(
  filters: SupplierFilters & {
    sortBy?: string
    sortDir?: 'asc' | 'desc'
    dueMin?: number | null
    dueMax?: number | null
    branchId?: string | null
  } = {},
): Promise<{ items: SupplierDirectoryCard[]; total: number }> {
  const { data, error } = await (supabase as unknown as {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: Error | null }>
  }).rpc('get_supplier_directory_cards', {
    p_search: filters.search?.trim() || null,
    p_status: filters.status ?? null,
    p_due_only: filters.dueOnly ?? false,
    p_due_min: filters.dueMin ?? null,
    p_due_max: filters.dueMax ?? null,
    p_branch_id: filters.branchId ?? null,
    p_sort_by: filters.sortBy ?? 'name',
    p_sort_dir: filters.sortDir ?? 'asc',
    p_page: filters.page ?? 1,
    p_page_size: filters.pageSize ?? 30,
  })
  if (error) throw error
  const raw = (data ?? {}) as Record<string, unknown>
  const items = Array.isArray(raw.items) ? raw.items : []
  return {
    total: Number(raw.total_count ?? 0),
    items: items.map((row) => {
      const r = row as Record<string, unknown>
      return {
        ...(r as unknown as Supplier),
        id: String(r.id),
        name: String(r.name ?? ''),
        phone: (r.phone as string | null) ?? null,
        email: (r.email as string | null) ?? null,
        address: (r.address as string | null) ?? null,
        status: String(r.status ?? 'active'),
        current_due: Number(r.current_due ?? 0),
        organization_id: String(r.organization_id ?? ''),
        branch_id: (r.branch_id as string | null) ?? null,
        barcode: (r.barcode as string | null) ?? null,
        notes: (r.notes as string | null) ?? null,
        created_at: String(r.created_at ?? ''),
        updated_at: String(r.updated_at ?? ''),
        created_by: (r.created_by as string | null) ?? null,
        updated_by: (r.updated_by as string | null) ?? null,
        deleted_at: (r.deleted_at as string | null) ?? null,
        total_paid: Number(r.total_paid ?? 0),
        total_purchased: Number(r.total_purchased ?? 0),
        stock_on_hand: r.stock_on_hand == null ? null : Number(r.stock_on_hand),
        units_sold: r.units_sold == null ? null : Number(r.units_sold),
        last_activity_at: (r.last_activity_at as string | null) ?? null,
      }
    }),
  }
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
  getSupplierLedgerStatement,
  getSupplierDirectorySummary,
  listSupplierDirectoryCards,
  listSupplierDocuments,
  uploadSupplierDocument,
  deleteSupplierDocument,
  listSupplierPurchases,
}
