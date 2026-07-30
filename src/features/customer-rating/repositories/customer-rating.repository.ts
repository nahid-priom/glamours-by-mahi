import { supabase } from '@/lib/supabase/client'
import type {
  CustomerRatingStatus,
  CustomerRecentOrder,
  PosCustomerSummary,
  TopCustomerRow,
} from '../types'

type UntypedRpc = (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>

const untypedRpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc

function asNumber(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function asRatingStatus(v: unknown): CustomerRatingStatus {
  if (v === 'provisional' || v === 'rated' || v === 'unrated') return v
  return 'unrated'
}

function mapSummary(raw: Record<string, unknown>): PosCustomerSummary {
  const fs = String(raw.financial_status ?? 'settled')
  const ratingRaw = raw.rating
  return {
    id: String(raw.id),
    name: String(raw.name ?? ''),
    phone: String(raw.phone ?? ''),
    email: (raw.email as string | null) ?? null,
    address: (raw.address as string | null) ?? null,
    district: (raw.district as string | null) ?? null,
    status: String(raw.status ?? 'active'),
    current_due: asNumber(raw.current_due),
    current_advance: asNumber(raw.current_advance),
    total_spent: asNumber(raw.total_spent),
    total_paid: asNumber(raw.total_paid),
    completed_orders: asNumber(raw.completed_orders),
    return_count: asNumber(raw.return_count),
    return_total: asNumber(raw.return_total),
    last_purchase_at: (raw.last_purchase_at as string | null) ?? null,
    rating: ratingRaw == null || ratingRaw === '' ? null : asNumber(ratingRaw, 0),
    rating_status: asRatingStatus(raw.rating_status),
    financial_status: fs === 'due' || fs === 'advance' ? fs : 'settled',
  }
}

export async function getPosCustomerSummary(customerId: string): Promise<PosCustomerSummary> {
  const { data, error } = await untypedRpc('get_pos_customer_summary', {
    p_customer_id: customerId,
  })
  if (error) throw new Error(error.message)
  if (!data || typeof data !== 'object') throw new Error('Customer summary unavailable')
  return mapSummary(data as Record<string, unknown>)
}

export async function listCustomerRecentOrders(
  customerId: string,
  limit = 10,
): Promise<CustomerRecentOrder[]> {
  const { data, error } = await untypedRpc('list_customer_recent_orders', {
    p_customer_id: customerId,
    p_limit: limit,
  })
  if (error) throw new Error(error.message)
  const rows = Array.isArray(data) ? data : []
  return rows.map((r) => {
    const row = r as Record<string, unknown>
    return {
      id: String(row.id),
      invoice_no: String(row.invoice_no ?? ''),
      status: String(row.status ?? ''),
      fulfilment_status: (row.fulfilment_status as string | null) ?? null,
      channel: (row.channel as string | null) ?? null,
      order_source: (row.order_source as string | null) ?? null,
      grand_total: asNumber(row.grand_total),
      due_total: asNumber(row.due_total),
      created_at: String(row.created_at ?? ''),
      completed_at: (row.completed_at as string | null) ?? null,
    }
  })
}

export async function refreshCustomerRating(customerId: string): Promise<{
  score: number | null
  rating_status: CustomerRatingStatus
}> {
  const { data, error } = await untypedRpc('refresh_customer_rating', {
    p_customer_id: customerId,
  })
  if (error) throw new Error(error.message)
  const row = data as { score?: number | null; rating_status?: string } | null
  return {
    score: row?.score == null ? null : asNumber(row.score),
    rating_status: asRatingStatus(row?.rating_status),
  }
}

export type ListTopCustomersArgs = {
  limit?: number
  offset?: number
  sort?: 'rating' | 'spent' | 'orders' | 'recent'
  search?: string
  branchId?: string | null
  /** Inclusive period start (YYYY-MM-DD or ISO). When set with `to`, ranks by period metrics. */
  from?: string | null
  /** Inclusive period end (YYYY-MM-DD or ISO). */
  to?: string | null
}

export async function listTopCustomers(
  limitOrArgs: number | ListTopCustomersArgs = 20,
  sort: 'rating' | 'spent' = 'rating',
): Promise<TopCustomerRow[]> {
  const args: ListTopCustomersArgs =
    typeof limitOrArgs === 'number'
      ? { limit: limitOrArgs, sort, offset: 0 }
      : limitOrArgs

  const { data, error } = await untypedRpc('list_top_customers', {
    payload: {
      limit: args.limit ?? 20,
      offset: args.offset ?? 0,
      sort: args.sort ?? 'spent',
      search: args.search ?? null,
      branch_id: args.branchId ?? null,
      from: args.from ?? null,
      to: args.to ?? null,
    },
  })
  if (error) throw new Error(error.message)
  const rows = Array.isArray(data) ? data : []
  return rows.map((r) => {
    const row = r as Record<string, unknown>
    return {
      id: String(row.id),
      name: String(row.name ?? ''),
      phone: String(row.phone ?? ''),
      current_due: asNumber(row.current_due),
      current_advance: asNumber(row.current_advance),
      total_spent: asNumber(row.total_spent),
      status: String(row.status ?? 'active'),
      rating: row.rating == null ? null : asNumber(row.rating),
      rating_status: asRatingStatus(row.rating_status),
      completed_orders: asNumber(row.completed_orders),
      return_total: asNumber(row.return_total),
      last_purchase_at: (row.last_purchase_at as string | null) ?? null,
      rank: row.rank != null ? asNumber(row.rank) : undefined,
    }
  })
}
