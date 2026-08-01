import { supabase } from '@/lib/supabase/client'

export type SupplierRatingStatus = 'unrated' | 'provisional' | 'rated'

export type SupplierRatingSummary = {
  supplier_id: string
  score: number | null
  rating_status: SupplierRatingStatus
  factors: Record<string, unknown>
  computed_at: string
}

type UntypedRpc = (fn: string, args?: object) => Promise<{ data: unknown; error: { message: string } | null }>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const untypedFrom = ((table: string) => (supabase as any).from(table)) as (table: string) => any
const untypedRpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc

function asRatingStatus(v: unknown): SupplierRatingStatus {
  if (v === 'provisional' || v === 'rated' || v === 'unrated') return v
  return 'unrated'
}

export async function refreshSupplierRating(supplierId: string): Promise<SupplierRatingSummary> {
  const { data, error } = await untypedRpc('refresh_supplier_rating', { p_supplier_id: supplierId })
  if (error) throw error
  const row = data as Record<string, unknown>
  return {
    supplier_id: String(row.supplier_id ?? supplierId),
    score: row.score == null ? null : Number(row.score),
    rating_status: asRatingStatus(row.rating_status),
    factors: (row.factors as Record<string, unknown>) ?? {},
    computed_at: String(row.computed_at ?? new Date().toISOString()),
  }
}

export async function getSupplierRating(supplierId: string): Promise<SupplierRatingSummary | null> {
  const { data, error } = await untypedFrom('supplier_rating_summaries')
    .select('supplier_id, score, rating_status, factors, computed_at')
    .eq('supplier_id', supplierId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    supplier_id: data.supplier_id as string,
    score: data.score == null ? null : Number(data.score),
    rating_status: asRatingStatus(data.rating_status),
    factors: (data.factors as Record<string, unknown>) ?? {},
    computed_at: data.computed_at as string,
  }
}
