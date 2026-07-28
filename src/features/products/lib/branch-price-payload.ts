import type { VariantDraft } from './variant-matrix'

export type BranchPricePayloadRow = {
  branch_id: string
  variant_key?: string
  retail_price: number
  wholesale_price: number | null
}

export function buildBranchPricesPayload(input: {
  branchId: string
  isMatrix: boolean
  variantDrafts?: VariantDraft[]
  variantStock?: Record<string, number>
  retailPrice: number
  wholesalePrice: number | null
  openingQuantity?: number
}): BranchPricePayloadRow[] {
  if (!input.branchId) return []

  if (input.isMatrix && input.variantDrafts && input.variantStock) {
    return input.variantDrafts
      .filter((variant) => (input.variantStock![variant.key] ?? 0) > 0)
      .map((variant) => ({
        branch_id: input.branchId,
        variant_key: variant.key,
        retail_price: variant.selling_price,
        wholesale_price: variant.wholesale_price,
      }))
  }

  if (!input.isMatrix && (input.openingQuantity ?? 0) > 0) {
    return [
      {
        branch_id: input.branchId,
        retail_price: input.retailPrice,
        wholesale_price: input.wholesalePrice,
      },
    ]
  }

  return []
}
