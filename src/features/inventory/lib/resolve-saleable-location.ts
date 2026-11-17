import type { Tables } from '@/types/database'

export type SaleableLocationCandidate = Pick<
  Tables<'stock_locations'>,
  'id' | 'name' | 'location_type' | 'is_active' | 'is_default' | 'deleted_at' | 'created_at' | 'branch_id'
>

/**
 * Mirrors SQL `_saleable_location`: saleable + active, prefer is_default, then oldest created_at.
 */
export function pickDefaultSaleableLocation<T extends SaleableLocationCandidate>(
  locations: T[],
): T | null {
  const saleable = locations.filter(
    (l) => l.location_type === 'saleable' && l.is_active && !l.deleted_at,
  )
  if (saleable.length === 0) return null
  return [...saleable].sort((a, b) => {
    if (a.is_default !== b.is_default) return a.is_default ? -1 : 1
    return String(a.created_at).localeCompare(String(b.created_at))
  })[0]!
}

export function requireDefaultSaleableLocation<T extends SaleableLocationCandidate>(
  locations: T[],
  branchLabel = 'this branch',
): T {
  const loc = pickDefaultSaleableLocation(locations)
  if (!loc) {
    throw new Error(
      `No saleable stock location configured for ${branchLabel}. Add a default saleable location in inventory settings.`,
    )
  }
  return loc
}
