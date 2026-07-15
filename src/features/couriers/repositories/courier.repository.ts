import { supabase } from '@/lib/supabase/client'
import type { Json } from '@/types/database'

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

async function listCompanies() {
  const { data, error } = await supabase
    .from('courier_companies')
    .select(
      'id, name, code, contact_phone, status, connection_status, success_rate, api_base_url, created_at',
    )
    .is('deleted_at', null)
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

async function upsertCompany(input: {
  id?: string
  organization_id: string
  name: string
  code?: string | null
  contact_phone?: string | null
  api_base_url?: string | null
  status?: 'active' | 'inactive' | 'archived'
}) {
  if (input.id) {
    const { data, error } = await supabase
      .from('courier_companies')
      .update({
        name: input.name,
        code: input.code ?? null,
        contact_phone: input.contact_phone ?? null,
        api_base_url: input.api_base_url ?? null,
        status: input.status ?? 'active',
      })
      .eq('id', input.id)
      .select('id')
      .single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase
    .from('courier_companies')
    .insert({
      organization_id: input.organization_id,
      name: input.name,
      code: input.code ?? null,
      contact_phone: input.contact_phone ?? null,
      api_base_url: input.api_base_url ?? null,
      status: input.status ?? 'active',
    })
    .select('id')
    .single()
  if (error) throw error
  return data
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
      id, status, cod_amount, courier_charge, return_charge, settlement_amount,
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

async function markSettlementSettled(id: string, financialAccountId?: string | null) {
  const { data, error } = await supabase
    .from('courier_settlements')
    .update({
      status: 'settled',
      settlement_date: new Date().toISOString().slice(0, 10),
      financial_account_id: financialAccountId ?? null,
    })
    .eq('id', id)
    .select('id')
    .single()
  if (error) throw error
  return data
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
  upsertCompany,
  listParcels,
  bookParcel,
  listTrackingEvents,
  listReturnRequests,
  approveReturn,
  rejectReturn,
  listSettlements,
  markSettlementSettled,
  searchSales,
}
