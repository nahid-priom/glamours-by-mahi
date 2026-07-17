import { supabase } from '@/lib/supabase/client'
import { resolveStorageUrl } from '@/features/products/repositories/catalog.repository'
import type { Json, Tables } from '@/types/database'
import type { EntityOption } from '@/components/entity-combobox'
import { filtersToRpcPayload } from '../schemas/sale-filters.schema'
import type {
  EditSalePayload,
  SalesHistoryFilters,
  SalesHistoryKpis,
  SalesHistoryListResult,
  SalesHistoryRow,
} from '../types/sale.types'

type UntypedRpc = (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>

const untypedRpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc

export type Sale = Tables<'sales'>
export type SaleItem = Tables<'sale_items'>
export type SalePayment = Tables<'sale_payments'>
export type SaleReturn = Tables<'sale_returns'>

/** @deprecated Prefer SalesHistoryFilters */
export type SaleFilters = {
  branchId?: string | null
  customerId?: string | null
  paymentStatus?: string | null
  status?: string | null
  fromDate?: string | null
  toDate?: string | null
  search?: string
  page?: number
  pageSize?: number
}

export type SaleListItem = Sale & {
  customers?: { id: string; name: string; phone: string | null } | null
  branches?: { id: string; name: string } | null
}

export type SaleDetail = Sale & {
  customers?: { id: string; name: string; phone: string | null; email: string | null } | null
  branches?: { id: string; name: string; address?: string | null; phone?: string | null } | null
  sale_items?: Array<
    SaleItem & {
      product_variants?: {
        sku: string
        name: string | null
        barcode?: string | null
        products?: {
          id: string
          name: string
          image_url?: string | null
          category_id?: string | null
          product_images?: Array<{
            storage_path: string
            is_cover: boolean
            deleted_at: string | null
          }>
        } | null
      } | null
    }
  >
  sale_payments?: SalePayment[]
}

function range(page: number, pageSize: number) {
  const from = (page - 1) * pageSize
  return { from, to: from + pageSize - 1 }
}

export async function listSalesHistory(
  filters: SalesHistoryFilters,
): Promise<SalesHistoryListResult> {
  const { data, error } = await untypedRpc('sales_history_list', {
    p_filters: filtersToRpcPayload(filters),
  })
  if (error) throw error
  const raw = (data ?? {}) as Record<string, unknown>
  const items = ((raw.items as SalesHistoryRow[]) ?? []).map((row) => ({
    ...row,
    category_summary: Array.isArray(row.category_summary) ? row.category_summary : [],
    item_qty: Number(row.item_qty ?? 0),
    subtotal: Number(row.subtotal ?? 0),
    discount: Number(row.discount ?? 0),
    grand_total: Number(row.grand_total ?? 0),
    paid_total: Number(row.paid_total ?? 0),
    due_total: Number(row.due_total ?? 0),
    change_amount: Number(row.change_amount ?? 0),
  }))
  return {
    items,
    total: Number(raw.total ?? 0),
    page: Number(raw.page ?? filters.page),
    page_size: Number(raw.page_size ?? filters.pageSize),
  }
}

export async function getSalesHistoryKpis(
  filters: SalesHistoryFilters,
): Promise<SalesHistoryKpis> {
  const { data, error } = await untypedRpc('sales_history_kpis', {
    p_filters: filtersToRpcPayload(filters),
  })
  if (error) throw error
  const raw = (data ?? {}) as Record<string, unknown>
  return {
    total_sales: Number(raw.total_sales ?? 0),
    total_paid: Number(raw.total_paid ?? 0),
    total_due: Number(raw.total_due ?? 0),
    total_discount: Number(raw.total_discount ?? 0),
    total_invoices: Number(raw.total_invoices ?? 0),
    returned_voided: Number(raw.returned_voided ?? 0),
    average_invoice: Number(raw.average_invoice ?? 0),
    total_items_sold: Number(raw.total_items_sold ?? 0),
  }
}

export async function exportSalesHistory(
  filters: SalesHistoryFilters,
): Promise<SalesHistoryListResult> {
  const { data, error } = await untypedRpc('sales_history_export', {
    p_filters: filtersToRpcPayload(filters),
  })
  if (error) throw error
  const raw = (data ?? {}) as Record<string, unknown>
  return {
    items: ((raw.items as SalesHistoryRow[]) ?? []).map((row) => ({
      ...row,
      category_summary: Array.isArray(row.category_summary) ? row.category_summary : [],
    })),
    total: Number(raw.total ?? 0),
    page: 1,
    page_size: Number(raw.page_size ?? 5000),
  }
}

/** Legacy list kept for transitional callers */
export async function listSales(
  filters: SaleFilters = {},
): Promise<{ items: SaleListItem[]; total: number }> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 30
  const { from, to } = range(page, pageSize)

  let q = supabase
    .from('sales')
    .select(
      `
      *,
      customers(id, name, phone),
      branches(id, name)
    `,
      { count: 'exact' },
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters.branchId) q = q.eq('branch_id', filters.branchId)
  if (filters.customerId) q = q.eq('customer_id', filters.customerId)
  if (filters.paymentStatus) {
    q = q.eq(
      'payment_status',
      filters.paymentStatus as 'unpaid' | 'partial' | 'paid' | 'overpaid' | 'refunded',
    )
  }
  if (filters.status) {
    q = q.eq('status', filters.status as 'draft' | 'completed' | 'voided' | 'corrected')
  }
  if (filters.fromDate) q = q.gte('created_at', filters.fromDate)
  if (filters.toDate) q = q.lte('created_at', filters.toDate)
  if (filters.search?.trim()) {
    const s = filters.search.trim()
    q = q.ilike('invoice_no', `%${s}%`)
  }

  const { data, error, count } = await q
  if (error) throw error
  return { items: (data ?? []) as unknown as SaleListItem[], total: count ?? 0 }
}

export async function getSale(id: string): Promise<SaleDetail | null> {
  const { data, error } = await supabase
    .from('sales')
    .select(
      `
      *,
      customers(id, name, phone, email),
      branches(id, name, address, phone),
      sale_items(
        *,
        product_variants(
          sku,
          name,
          barcode,
          products(
            id,
            name,
            category_id,
            product_images(storage_path, is_cover, deleted_at)
          )
        )
      ),
      sale_payments(*)
    `,
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  const sale = data as unknown as SaleDetail | null
  if (!sale) return null
  await Promise.all(
    (sale.sale_items ?? []).map(async (item) => {
      const product = item.product_variants?.products
      if (!product) return
      const activeImages = (product.product_images ?? []).filter((image) => !image.deleted_at)
      const cover = activeImages.find((image) => image.is_cover) ?? activeImages[0]
      product.image_url = await resolveStorageUrl(cover?.storage_path)
    }),
  )
  return sale
}

export async function getSaleTimeline(saleId: string) {
  const [activity, audit] = await Promise.all([
    supabase
      .from('activity_logs')
      .select('*')
      .eq('entity_type', 'sale')
      .eq('entity_id', saleId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('audit_logs')
      .select('*')
      .eq('entity_type', 'sale')
      .eq('entity_id', saleId)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const events = [
    ...(activity.data ?? []).map((e) => ({
      id: e.id,
      source: 'activity' as const,
      action: e.action,
      message: e.summary ?? e.action,
      created_at: e.created_at,
      meta: e.details,
    })),
    ...(audit.data ?? []).map((e) => ({
      id: e.id,
      source: 'audit' as const,
      action: e.action,
      message: e.reason ?? e.action,
      created_at: e.created_at,
      meta: e.after_data,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return events
}

export async function collectDue(payload: {
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
  const clientTxnKey =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `col-${Date.now()}`
  const { data, error } = await supabase.rpc('collect_customer_due', {
    payload: {
      customer_id: payload.customer_id,
      branch_id: payload.branch_id,
      amount: payload.amount,
      note: payload.note ?? null,
      client_txn_key: clientTxnKey,
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

export async function voidSale(saleId: string, reason: string, note?: string | null) {
  const fullReason = note?.trim() ? `${reason.trim()} — ${note.trim()}` : reason.trim()
  const { data, error } = await supabase.rpc('void_sale', {
    sale_id: saleId,
    reason: fullReason,
  })
  if (error) throw error
  return data
}

export async function editSale(payload: EditSalePayload) {
  const { data, error } = await untypedRpc('edit_sale', {
    payload: payload as unknown as Record<string, unknown>,
  })
  if (error) throw error
  return data as {
    original_sale_id: string
    new_sale_id: string
    new_invoice_no?: string
    idempotent?: boolean
  }
}

export async function requestCorrection(payload: {
  sale_id: string
  reason: string
  note?: string | null
  items?: Json
}) {
  const { data, error } = await supabase.rpc('request_sale_correction', {
    sale_id: payload.sale_id,
    reason: payload.reason,
    items: (payload.items ?? []) as Json,
  })
  if (error) throw error
  return data
}

export async function approveSalesReturn(payload: {
  sale_id: string
  items: Array<{ sale_item_id: string; qty: number; condition?: string }>
  reason?: string | null
  refund_account_id?: string | null
}) {
  const clientTxnKey =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `ret-${Date.now()}`
  const { data, error } = await supabase.rpc('approve_sales_return', {
    payload: {
      sale_id: payload.sale_id,
      items: payload.items,
      reason: payload.reason ?? null,
      refund_account_id: payload.refund_account_id ?? null,
      client_txn_key: clientTxnKey,
    } as unknown as Json,
  })
  if (error) throw error
  return data
}

export async function listSaleReturns(
  filters: { page?: number; pageSize?: number; status?: string; search?: string } = {},
): Promise<{ items: Array<SaleReturn & { sales?: { invoice_no: string } | null }>; total: number }> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 30
  const { from, to } = range(page, pageSize)

  let q = supabase
    .from('sale_returns')
    .select('*, sales(invoice_no)', { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters.status) {
    q = q.eq('status', filters.status as 'pending' | 'approved' | 'rejected' | 'completed')
  }

  const { data, error, count } = await q
  if (error) throw error
  return {
    items: (data ?? []) as unknown as Array<SaleReturn & { sales?: { invoice_no: string } | null }>,
    total: count ?? 0,
  }
}

export async function searchCustomers(query: string): Promise<EntityOption[]> {
  const q = query.trim()
  let builder = supabase
    .from('customers')
    .select('id, name, phone, email')
    .is('deleted_at', null)
    .neq('status', 'archived')
    .order('name')
    .limit(20)
  if (q) builder = builder.or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
  const { data, error } = await builder
  if (error) throw error
  return (data ?? []).map((c) => ({
    id: c.id,
    label: c.name,
    description: c.phone ?? undefined,
  }))
}

export async function listPaymentMethods() {
  const { data, error } = await supabase
    .from('payment_methods')
    .select('id, code, name, financial_account_id, is_due, is_active, sort_order')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('sort_order')
  if (error) throw error
  return data ?? []
}

export async function searchBranches(query: string): Promise<EntityOption[]> {
  const q = query.trim()
  let builder = supabase
    .from('branches')
    .select('id, name, code')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name')
    .limit(20)
  if (q) builder = builder.or(`name.ilike.%${q}%,code.ilike.%${q}%`)
  const { data, error } = await builder
  if (error) throw error
  return (data ?? []).map((b) => ({ id: b.id, label: b.name, description: b.code }))
}

export async function searchCashiers(query: string): Promise<EntityOption[]> {
  const q = query.trim()
  let builder = supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('full_name')
    .limit(20)
  if (q) builder = builder.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
  const { data, error } = await builder
  if (error) throw error
  return (data ?? []).map((p) => ({
    id: p.id,
    label: p.full_name,
    description: p.email,
  }))
}

export async function searchCategories(query: string): Promise<EntityOption[]> {
  const q = query.trim()
  let builder = supabase
    .from('categories')
    .select('id, name, code')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name')
    .limit(20)
  if (q) builder = builder.or(`name.ilike.%${q}%,code.ilike.%${q}%`)
  const { data, error } = await builder
  if (error) throw error
  return (data ?? []).map((c) => ({
    id: c.id,
    label: c.name,
    description: c.code ?? undefined,
  }))
}

export const salesRepository = {
  listSalesHistory,
  getSalesHistoryKpis,
  exportSalesHistory,
  listSales,
  getSale,
  getSaleTimeline,
  collectDue,
  voidSale,
  editSale,
  requestCorrection,
  approveSalesReturn,
  listSaleReturns,
  searchCustomers,
  listPaymentMethods,
  searchBranches,
  searchCashiers,
  searchCategories,
}
