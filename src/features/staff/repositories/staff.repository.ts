import { supabase } from '@/lib/supabase/client'

type UntypedRpc = (
  fn: string,
  args?: object,
) => Promise<{ data: unknown; error: { message: string } | null }>
const untypedRpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc

export type StaffDashboardSummary = {
  staff_user_id: string
  branch_id: string | null
  kpis: {
    today_sales: number
    today_orders: number
    yesterday_sales: number
    month_sales: number
    month_orders: number
    pending_orders: number
    commission_today: number
    commission_month: number
    commission_pending: number
    follow_ups_due: number
    follow_ups_overdue: number
    new_customers_today: number
  }
  target: {
    id: string
    period: string
    sales_amount: number
    order_count: number
    starts_at: string
    ends_at: string
    achieved_sales: number
    achieved_orders: number
    days_remaining: number
    pct: number
  } | null
  recent_sales: Array<{
    id: string
    invoice_no: string
    grand_total: number
    paid_total: number
    due_total: number
    status: string
    fulfilment_status: string | null
    order_source: string | null
    created_at: string
    customer_name: string | null
    customer_phone: string | null
  }>
  pending_follow_ups: Array<{
    id: string
    customer_id: string
    follow_up_at: string
    priority: string
    note: string | null
    status: string
    customer_name: string
    customer_phone: string | null
    current_due: number
  }>
  refreshed_at: string
}

export type StaffCommissionSummary = {
  today: number
  week: number
  month: number
  pending: number
  approved: number
  paid: number
  reversed: number
  last_paid_at: string | null
}

async function rpc<T>(fn: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await untypedRpc(fn, { payload })
  if (error) throw error
  return data as T
}

export function getStaffDashboardSummary(filters: {
  branchId?: string | null
  staffUserId?: string | null
} = {}) {
  return rpc<StaffDashboardSummary>('get_staff_dashboard_summary', {
    branch_id: filters.branchId || null,
    staff_user_id: filters.staffUserId || null,
  })
}

export type StaffSaleRow = StaffDashboardSummary['recent_sales'][number] & {
  commission_amount?: number
  branch_id?: string
}

export function listStaffSales(filters: Record<string, unknown> = {}) {
  return rpc<{
    items: StaffSaleRow[]
    total: number
    page: number
    page_size: number
  }>('list_staff_sales', filters)
}

export function getStaffCommissionSummary() {
  return rpc<StaffCommissionSummary>('get_staff_commission_summary', {})
}

export type StaffCommissionEntry = {
  id: string
  sale_id: string | null
  sale_item_id?: string | null
  product_id?: string | null
  variant_id?: string | null
  product_name?: string | null
  variant_name?: string | null
  qty?: number | null
  event_type?: string | null
  commission_amount: number
  reversed_amount?: number | null
  original_commission_amount?: number | null
  base_amount: number
  status: string
  created_at: string
  approved_at: string | null
  paid_at: string | null
  invoice_no: string | null
  grand_total: number | null
  customer_name: string | null
}

export function listStaffCommissionEntries(filters: Record<string, unknown> = {}) {
  return rpc<{
    items: StaffCommissionEntry[]
    page: number
    page_size: number
  }>('list_staff_commission_entries', filters)
}

export function listStaffFollowUps(filters: Record<string, unknown> = {}) {
  return rpc<StaffDashboardSummary['pending_follow_ups']>('list_staff_follow_ups', filters)
}

export function upsertStaffFollowUp(payload: Record<string, unknown>) {
  return rpc<Record<string, unknown>>('upsert_staff_follow_up', payload)
}

export function completeStaffFollowUp(id: string, note?: string) {
  return rpc<Record<string, unknown>>('complete_staff_follow_up', { id, note: note || null })
}

export function assignStaffTarget(payload: Record<string, unknown>) {
  return rpc<Record<string, unknown>>('assign_staff_target', payload)
}

export function listMyAssignedCustomers(limit = 50) {
  return rpc<
    Array<{
      id: string
      name: string
      phone: string | null
      current_due: number
      created_at: string
      assigned_at: string
      last_purchase_at: string | null
      last_follow_up_at: string | null
      rating_score: number | null
    }>
  >('list_my_assigned_customers', { limit })
}
