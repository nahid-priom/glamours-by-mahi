import { supabase } from '@/lib/supabase/client'
import type { ActivityFeedItem } from '../lib/activity-copy'

type UntypedRpc = (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>

const untypedRpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc

export type ActivityFeedFilters = {
  from?: string | null
  to?: string | null
  branchId?: string | null
  actorId?: string | null
  module?: string | null
  search?: string | null
  limit?: number
  offset?: number
}

export type ActivityFeedResult = {
  items: ActivityFeedItem[]
  total: number
  limit: number
  offset: number
}

function mapItem(raw: Record<string, unknown>): ActivityFeedItem {
  return {
    id: String(raw.id),
    created_at: String(raw.created_at ?? ''),
    branch_id: (raw.branch_id as string | null) ?? null,
    branch_name: (raw.branch_name as string | null) ?? null,
    actor_id: (raw.actor_id as string | null) ?? null,
    actor_name: (raw.actor_name as string | null) ?? null,
    action: String(raw.action ?? ''),
    entity_type: String(raw.entity_type ?? ''),
    entity_id: (raw.entity_id as string | null) ?? null,
    reason: (raw.reason as string | null) ?? null,
    module: String(raw.module ?? 'other'),
    before_data: (raw.before_data as Record<string, unknown> | null) ?? null,
    after_data: (raw.after_data as Record<string, unknown> | null) ?? null,
    request_meta: (raw.request_meta as Record<string, unknown> | null) ?? null,
  }
}

export async function listActivityFeed(
  filters: ActivityFeedFilters = {},
): Promise<ActivityFeedResult> {
  const { data, error } = await untypedRpc('list_activity_feed', {
    payload: {
      from: filters.from ?? null,
      to: filters.to ?? null,
      branch_id: filters.branchId ?? null,
      actor_id: filters.actorId ?? null,
      module: filters.module ?? null,
      search: filters.search ?? null,
      limit: filters.limit ?? 40,
      offset: filters.offset ?? 0,
    },
  })
  if (error) throw new Error(error.message)
  const payload = (data ?? {}) as Record<string, unknown>
  const items = Array.isArray(payload.items)
    ? (payload.items as Record<string, unknown>[]).map(mapItem)
    : []
  return {
    items,
    total: Number(payload.total ?? 0),
    limit: Number(payload.limit ?? filters.limit ?? 40),
    offset: Number(payload.offset ?? filters.offset ?? 0),
  }
}
