import { supabase } from '@/lib/supabase/client'
import { createStaffOnlineOrder } from '@/features/sales/repositories/online-orders.repository'

type UntypedRpc = (
  fn: string,
  args?: object,
) => Promise<{ data: unknown; error: { message: string } | null }>

const rpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc

export type ModeratorDashboardSummary = {
  orders_today: number
  orders_month: number
  draft_orders: number
  pending_approval: number
  approved_orders: number
  cancelled_orders: number
  delivered_orders: number
  total_order_value: number
  average_order_value: number
  recent_orders: Array<{
    id: string
    invoice_no: string
    status: string
    fulfilment_status: string | null
    order_source: string | null
    grand_total: number
    created_at: string
    customer_id: string | null
    customer_name: string | null
    customer_phone: string | null
  }>
}

export async function getModeratorDashboardSummary(filters: {
  from?: string
  to?: string
  ownOnly?: boolean
} = {}): Promise<ModeratorDashboardSummary> {
  const { data, error } = await rpc('get_moderator_dashboard_summary', {
    payload: {
      from: filters.from ?? null,
      to: filters.to ?? null,
      own_only: filters.ownOnly ?? true,
      recent_limit: 12,
    },
  })
  if (error) throw new Error(error.message)
  const row = (data ?? {}) as Record<string, unknown>
  return {
    orders_today: Number(row.orders_today ?? 0),
    orders_month: Number(row.orders_month ?? 0),
    draft_orders: Number(row.draft_orders ?? 0),
    pending_approval: Number(row.pending_approval ?? 0),
    approved_orders: Number(row.approved_orders ?? 0),
    cancelled_orders: Number(row.cancelled_orders ?? 0),
    delivered_orders: Number(row.delivered_orders ?? 0),
    total_order_value: Number(row.total_order_value ?? 0),
    average_order_value: Number(row.average_order_value ?? 0),
    recent_orders: Array.isArray(row.recent_orders)
      ? (row.recent_orders as ModeratorDashboardSummary['recent_orders'])
      : [],
  }
}

export { createStaffOnlineOrder }
