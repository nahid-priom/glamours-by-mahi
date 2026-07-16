import { supabase } from '@/lib/supabase/client'

export type PlaceEcommerceOrderPayload = {
  org_slug: string
  client_txn_key: string
  customer_name: string
  customer_phone: string
  customer_email?: string | null
  delivery_address: string
  district: string
  shipping: number
  note?: string
  items: Array<{ variant_id: string; quantity: number }>
}

export type PlaceEcommerceOrderResult = {
  sale_id: string
  invoice_no: string
  customer_id?: string
  grand_total: number
  due_total?: number
  shipping?: number
  public_share_token?: string
  idempotent?: boolean
}

export type TrackedOnlineSale = {
  id: string
  invoice_no: string
  grand_total: number
  due_total: number
  status: string
  channel: string
  completed_at: string | null
  public_share_token?: string | null
  customers: { name?: string; phone?: string } | null
}

type UntypedRpc = (
  fn: string,
  args?: object,
) => Promise<{ data: unknown; error: { message: string } | null }>

const rpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc

/** Maps storefront checkout → place_online_order (canonical ecommerce RPC). */
export async function placeEcommerceOrder(
  payload: PlaceEcommerceOrderPayload,
): Promise<PlaceEcommerceOrderResult> {
  const { data, error } = await rpc('place_online_order', {
    payload: {
      organization_slug: payload.org_slug,
      client_txn_key: payload.client_txn_key,
      customer_name: payload.customer_name,
      phone: payload.customer_phone,
      email: payload.customer_email ?? undefined,
      address: payload.delivery_address,
      district: payload.district,
      notes: payload.note,
      shipping: payload.shipping,
      items: payload.items.map((i) => ({
        variant_id: i.variant_id,
        qty: i.quantity,
      })),
    },
  })
  if (error) throw new Error(error.message || 'Order could not be placed')
  const result = data as PlaceEcommerceOrderResult & {
    public_share_token?: string
    grand_total?: number
    shipping?: number
  }
  if (!result?.sale_id) {
    throw new Error('Order response was incomplete. Please try again.')
  }
  return {
    sale_id: result.sale_id,
    invoice_no: result.invoice_no,
    customer_id: result.customer_id,
    grand_total: Number(result.grand_total ?? 0),
    due_total: result.due_total != null ? Number(result.due_total) : undefined,
    shipping: result.shipping != null ? Number(result.shipping) : payload.shipping,
    public_share_token: result.public_share_token,
    idempotent: result.idempotent,
  }
}

export const placeOnlineOrder = placeEcommerceOrder

export async function trackOnlineSale(query: string): Promise<TrackedOnlineSale[]> {
  const { data, error } = await rpc('track_online_order', { p_query: query })
  if (error) throw error
  return (data as TrackedOnlineSale[]) ?? []
}
