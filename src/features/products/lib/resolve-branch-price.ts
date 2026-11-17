import { supabase } from '@/lib/supabase/client'

export type BranchPriceRow = {
  product_id: string
  variant_id: string | null
  retail_price: number | null
  discount_price: number | null
  wholesale_price: number | null
  effective_from: string
  effective_to: string | null
}

export type BranchPriceIndex = {
  byVariant: Map<string, number>
  byProduct: Map<string, number>
}

function activeNow(row: BranchPriceRow, now = Date.now()): boolean {
  const from = new Date(row.effective_from).getTime()
  if (Number.isFinite(from) && from > now) return false
  if (row.effective_to) {
    const to = new Date(row.effective_to).getTime()
    if (Number.isFinite(to) && to <= now) return false
  }
  return true
}

function pickRetail(row: BranchPriceRow): number | null {
  const discount = row.discount_price
  if (discount != null && Number(discount) >= 0) return Number(discount)
  if (row.retail_price != null && Number(row.retail_price) >= 0) return Number(row.retail_price)
  return null
}

/** Build an in-memory index mirroring `resolve_effective_price` branch overrides. */
export function buildBranchPriceIndex(rows: BranchPriceRow[]): BranchPriceIndex {
  const byVariant = new Map<string, { price: number; from: number }>()
  const byProduct = new Map<string, { price: number; from: number }>()
  const now = Date.now()

  for (const row of rows) {
    if (!activeNow(row, now)) continue
    const price = pickRetail(row)
    if (price == null) continue
    const from = new Date(row.effective_from).getTime() || 0
    if (row.variant_id) {
      const prev = byVariant.get(row.variant_id)
      if (!prev || from >= prev.from) byVariant.set(row.variant_id, { price, from })
    } else {
      const prev = byProduct.get(row.product_id)
      if (!prev || from >= prev.from) byProduct.set(row.product_id, { price, from })
    }
  }

  return {
    byVariant: new Map([...byVariant.entries()].map(([k, v]) => [k, v.price])),
    byProduct: new Map([...byProduct.entries()].map(([k, v]) => [k, v.price])),
  }
}

/**
 * Precedence: branch+variant → branch+product → variant selling → product selling.
 * Same order as SQL `resolve_effective_price`.
 */
export function resolvePriceFromIndex(
  index: BranchPriceIndex | null | undefined,
  args: {
    productId: string
    variantId: string
    variantSellingPrice: number
    productSellingPrice?: number
  },
): number {
  const variantOverride = index?.byVariant.get(args.variantId)
  if (variantOverride != null) return variantOverride
  const productOverride = index?.byProduct.get(args.productId)
  if (productOverride != null) return productOverride
  if (Number.isFinite(args.variantSellingPrice)) return Number(args.variantSellingPrice)
  return Number(args.productSellingPrice ?? 0) || 0
}

export async function listActiveBranchPrices(branchId: string): Promise<BranchPriceRow[]> {
  const { data, error } = await supabase
    .from('branch_product_prices')
    .select(
      'product_id, variant_id, retail_price, discount_price, wholesale_price, effective_from, effective_to',
    )
    .eq('branch_id', branchId)
    .eq('is_active', true)
    .is('deleted_at', null)
  if (error) throw error
  return (data ?? []) as BranchPriceRow[]
}

export async function loadBranchPriceIndex(branchId: string): Promise<BranchPriceIndex> {
  const rows = await listActiveBranchPrices(branchId)
  return buildBranchPriceIndex(rows)
}

/** Single-row authority via RPC (authenticated). */
export async function resolveEffectivePriceRpc(args: {
  organizationId: string
  branchId: string
  productId: string
  variantId: string
}): Promise<number> {
  const { data, error } = await supabase.rpc('resolve_effective_price', {
    p_org_id: args.organizationId,
    p_branch_id: args.branchId,
    p_product_id: args.productId,
    p_variant_id: args.variantId,
  })
  if (error) throw error
  return Number(data ?? 0)
}
