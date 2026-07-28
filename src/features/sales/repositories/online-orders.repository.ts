import { supabase } from '@/lib/supabase/client'

export type OnlineOrderRow = {
  id: string
  invoice_no: string
  status: string
  fulfilment_status: string | null
  channel: string | null
  order_source?: string | null
  moderator_id?: string | null
  tele_salesman_id?: string | null
  approved_by?: string | null
  approved_at?: string | null
  fulfilled_by?: string | null
  created_by?: string | null
  grand_total: number
  due_total: number
  paid_total: number
  delivery_address: string | null
  delivery_district: string | null
  reservation_expires_at: string | null
  completed_at: string | null
  created_at: string
  public_share_token: string | null
  customer_id: string | null
  customer_name: string | null
  customer_phone: string | null
}

type UntypedRpc = (
  fn: string,
  args?: object,
) => Promise<{ data: unknown; error: { message: string } | null }>

const rpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc

export async function listOnlineOrders(filters: {
  status?: string
  orderSource?: string
  limit?: number
} = {}): Promise<OnlineOrderRow[]> {
  const { data, error } = await rpc('list_online_orders', {
    payload: {
      status: filters.status ?? null,
      order_source: filters.orderSource ?? null,
      limit: filters.limit ?? 100,
    },
  })
  if (error) throw new Error(error.message)
  return (data as OnlineOrderRow[]) ?? []
}

export async function fulfilOnlineOrder(saleId: string, payments?: unknown[]) {
  const { data, error } = await rpc('fulfil_online_order', {
    payload: {
      sale_id: saleId,
      payments: payments ?? undefined,
    },
  })
  if (error) throw new Error(error.message)
  return data
}

export async function cancelOnlineOrder(saleId: string, reason?: string) {
  const { data, error } = await rpc('cancel_online_order', {
    payload: {
      sale_id: saleId,
      reason: reason ?? 'Cancelled from admin queue',
    },
  })
  if (error) throw new Error(error.message)
  return data
}

export async function approveOnlineOrder(saleId: string) {
  const { data, error } = await rpc('approve_online_order', {
    payload: { sale_id: saleId },
  })
  if (error) throw new Error(error.message)
  return data
}

export async function assignOnlineOrder(saleId: string, teleSalesmanId: string) {
  const { data, error } = await rpc('assign_online_order', {
    payload: { sale_id: saleId, tele_salesman_id: teleSalesmanId },
  })
  if (error) throw new Error(error.message)
  return data
}

export async function createStaffOnlineOrder(payload: Record<string, unknown>) {
  const { data, error } = await rpc('create_staff_online_order', { payload })
  if (error) throw new Error(error.message)
  return data as {
    sale_id: string
    invoice_no: string
    grand_total: number
    fulfilment_status: string
    order_source: string
    idempotent: boolean
  }
}

export const onlineOrdersRepository = {
  listOnlineOrders,
  fulfilOnlineOrder,
  cancelOnlineOrder,
  approveOnlineOrder,
  assignOnlineOrder,
  createStaffOnlineOrder,
}
