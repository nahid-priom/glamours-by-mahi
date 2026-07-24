import { supabase } from '@/lib/supabase/client'
import type { Json, Tables } from '@/types/database'

export type CourierCompany = Tables<'courier_companies'>

export type CourierCompanyListItem = Pick<
  CourierCompany,
  | 'id'
  | 'name'
  | 'code'
  | 'contact_phone'
  | 'status'
  | 'connection_status'
  | 'success_rate'
  | 'api_base_url'
  | 'created_at'
  | 'updated_at'
>

export type CourierCompanyInput = {
  id?: string
  organization_id: string
  name: string
  code?: string | null
  contact_phone?: string | null
  api_base_url?: string | null
  status?: 'active' | 'inactive' | 'archived'
}

export type ParcelBookingInput = {
  organization_id: string
  branch_id?: string | null
  courier_company_id: string
  sale_id?: string | null
  tracking_no?: string
  customer_name?: string
  customer_phone?: string
  delivery_address?: string
  cod_amount?: number
  courier_charge?: number
}

async function listCompanies(filters?: { search?: string; status?: string | null }): Promise<CourierCompanyListItem[]> {
  let q = supabase
    .from('courier_companies')
    .select(
      'id, name, code, contact_phone, status, connection_status, success_rate, api_base_url, created_at, updated_at',
    )
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (filters?.status) q = q.eq('status', filters.status)
  if (filters?.search?.trim()) {
    const term = filters.search.trim()
    q = q.or(`name.ilike.%${term}%,code.ilike.%${term}%,contact_phone.ilike.%${term}%`)
  }

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as CourierCompanyListItem[]
}

async function getCompany(id: string) {
  const { data, error } = await supabase
    .from('courier_companies')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  return data
}

async function upsertCompany(input: CourierCompanyInput) {
  const payload = {
    name: input.name.trim(),
    code: input.code?.trim() || null,
    contact_phone: input.contact_phone?.trim() || null,
    api_base_url: input.api_base_url?.trim() || null,
    status: input.status ?? 'active',
  }

  if (input.id) {
    const { data, error } = await supabase
      .from('courier_companies')
      .update(payload)
      .eq('id', input.id)
      .select('*')
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from('courier_companies')
    .insert({
      organization_id: input.organization_id,
      ...payload,
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

async function deleteCompany(id: string) {
  const { error } = await supabase
    .from('courier_companies')
    .update({
      deleted_at: new Date().toISOString(),
      status: 'archived',
    })
    .eq('id', id)
  if (error) throw error
}

async function listParcels(filters?: {
  status?: 'booked' | 'picked_up' | 'in_transit' | 'delivered' | 'failed' | 'returned' | 'cancelled'
  companyId?: string
}) {
  let q = supabase
    .from('courier_parcels')
    .select(
      `
      id, tracking_no, status, cod_amount, courier_charge, customer_name, customer_phone,
      delivery_address, booked_at, delivered_at, sale_id, courier_company_id,
      courier_companies(name)
    `,
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(150)
  if (filters?.status) q = q.eq('status', filters.status)
  if (filters?.companyId) q = q.eq('courier_company_id', filters.companyId)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

async function bookParcel(input: ParcelBookingInput) {
  const tracking =
    input.tracking_no?.trim() ||
    `TRK-${Date.now().toString(36).toUpperCase()}`
  const { data, error } = await supabase
    .from('courier_parcels')
    .insert({
      organization_id: input.organization_id,
      branch_id: input.branch_id ?? null,
      courier_company_id: input.courier_company_id,
      sale_id: input.sale_id ?? null,
      tracking_no: tracking,
      customer_name: input.customer_name ?? null,
      customer_phone: input.customer_phone ?? null,
      delivery_address: input.delivery_address ?? null,
      cod_amount: input.cod_amount ?? 0,
      courier_charge: input.courier_charge ?? 0,
      status: 'booked',
    })
    .select('id, tracking_no')
    .single()
  if (error) throw error

  await supabase.from('courier_events').insert({
    organization_id: input.organization_id,
    courier_company_id: input.courier_company_id,
    parcel_id: data.id,
    external_event_id: `local-booked-${data.id}`,
    event_type: 'booked',
    payload: { source: 'parcel_booking' },
    occurred_at: new Date().toISOString(),
    processed_at: new Date().toISOString(),
  })

  return data
}

async function listTrackingEvents(parcelId?: string | null) {
  let q = supabase
    .from('courier_events')
    .select(
      'id, event_type, occurred_at, processed_at, parcel_id, courier_company_id, payload, courier_parcels(tracking_no, customer_name)',
    )
    .is('deleted_at', null)
    .order('occurred_at', { ascending: false })
    .limit(200)
  if (parcelId) q = q.eq('parcel_id', parcelId)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

async function listReturnRequests(status?: 'pending' | 'approved' | 'rejected') {
  let q = supabase
    .from('courier_return_requests')
    .select(
      `
      id, status, courier_reason, rejection_reason, created_at, reviewed_at, sale_id, parcel_id,
      courier_companies(name),
      courier_parcels(tracking_no, customer_name),
      courier_return_items(id, variant_id, expected_qty, received_qty, condition, notes, sale_item_id)
    `,
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100)
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

async function approveReturn(
  requestId: string,
  items: Array<{ id: string; received_qty: number; condition: string }>,
) {
  const { data, error } = await supabase.rpc('approve_courier_return', {
    request_id: requestId,
    items: items as unknown as Json,
  })
  if (error) throw error
  return data
}

async function rejectReturn(requestId: string, reason: string) {
  const { data, error } = await supabase.rpc('reject_courier_return', {
    request_id: requestId,
    reason,
  })
  if (error) throw error
  return data
}

async function listSettlements() {
  const { data, error } = await supabase
    .from('courier_settlements')
    .select(
      `
      id, status, cod_amount, courier_charge, return_charge, settlement_amount, settled_amount,
      settlement_date, notes, created_at, courier_company_id, parcel_id, sale_id,
      courier_companies(name), courier_parcels(tracking_no)
    `,
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(150)
  if (error) throw error
  return data ?? []
}

async function markSettlementSettled(
  id: string,
  financialAccountId: string,
  amount?: number,
) {
  const clientTxnKey =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `cset-${Date.now()}`
  const payload: Record<string, unknown> = {
    settlement_id: id,
    financial_account_id: financialAccountId,
    client_txn_key: clientTxnKey,
  }
  if (amount != null && amount > 0) payload.amount = amount
  const { data, error } = await supabase.rpc('settle_courier_settlement', {
    payload: payload as unknown as Json,
  })
  if (error) throw error
  return data
}

async function reverseSettlement(id: string, reason: string) {
  const clientTxnKey =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `cset-rev-${Date.now()}`
  const { data, error } = await supabase.rpc('reverse_courier_settlement', {
    payload: {
      settlement_id: id,
      client_txn_key: clientTxnKey,
      reason,
    } as unknown as Json,
  })
  if (error) throw error
  return data
}

async function updateParcelStatus(parcelId: string, status: string, notes?: string) {
  const { data, error } = await supabase.rpc('update_courier_parcel_status', {
    p_parcel_id: parcelId,
    p_status: status,
    p_notes: notes ?? undefined,
  })
  if (error) throw error
  return data
}

async function recordCodReceivable(parcelId: string) {
  const { data, error } = await supabase.rpc('record_courier_cod_receivable', {
    p_parcel_id: parcelId,
  })
  if (error) throw error
  return data
}

async function listFinancialAccounts() {
  const { data, error } = await supabase
    .from('financial_accounts')
    .select('id, name, account_kind, current_balance')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name')
  if (error) throw error
  return data ?? []
}

async function searchSales(query: string) {
  const q = query.trim()
  let builder = supabase
    .from('sales')
    .select('id, invoice_no, grand_total, status, customers(name, phone)')
    .is('deleted_at', null)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(20)
  if (q) builder = builder.or(`invoice_no.ilike.%${q}%`)
  const { data, error } = await builder
  if (error) throw error
  return (data ?? []).map((s) => {
    const c = s.customers as unknown as { name: string; phone: string } | null
    return {
      id: s.id,
      label: s.invoice_no,
      description: `${c?.name || 'Walk-in'} · ৳${Number(s.grand_total).toFixed(0)}`,
      customerName: c?.name ?? '',
      customerPhone: c?.phone ?? '',
    }
  })
}

export const courierRepository = {
  listCompanies,
  getCompany,
  upsertCompany,
  deleteCompany,
  listParcels,
  bookParcel,
  listTrackingEvents,
  listReturnRequests,
  approveReturn,
  rejectReturn,
  listSettlements,
  markSettlementSettled,
  reverseSettlement,
  updateParcelStatus,
  recordCodReceivable,
  listFinancialAccounts,
  searchSales,
}
