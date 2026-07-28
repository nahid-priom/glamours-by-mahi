import { COLOR_PRESETS, SIZE_PRESETS } from '@/config/catalog'

export type VariantDraft = {
  key: string
  label: string
  size: string
  color: string
  sku: string
  barcode: string
  purchase_price: number
  selling_price: number
  wholesale_price: number | null
  opening_stock: number
  is_active: boolean
}

function slugToken(value: string, max = 3): string {
  const cleaned = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  if (cleaned.length <= max) return cleaned.padEnd(max, 'X')
  return cleaned.slice(0, max)
}

export function buildAutoSku(parts: {
  categoryCode?: string | null
  brandCode?: string | null
  color: string
  size: string
  index: number
}): string {
  const cat = slugToken(parts.categoryCode ?? 'PRD', 2)
  const brand = slugToken(parts.brandCode ?? 'GB', 2)
  const color = slugToken(parts.color, 3)
  const size = slugToken(parts.size, 3)
  const seq = String(parts.index + 1).padStart(3, '0')
  return `${cat}-${brand}-${color}-${size}-${seq}`
}

/** Strict matrix: returns [] when sizes or colors are empty (no fallback combos). */
export function generateVariantMatrixStrict(input: {
  sizes: string[]
  colors: string[]
  purchasePrice: number
  sellingPrice: number
  wholesalePrice?: number | null
  categoryCode?: string | null
  brandCode?: string | null
  openingStock?: number
}): VariantDraft[] {
  if (!input.sizes.length || !input.colors.length) return []
  return generateVariantMatrix(input)
}

export function generateVariantMatrix(input: {
  sizes: string[]
  colors: string[]
  purchasePrice: number
  sellingPrice: number
  wholesalePrice?: number | null
  categoryCode?: string | null
  brandCode?: string | null
  openingStock?: number
}): VariantDraft[] {
  const sizes = input.sizes.length ? input.sizes : ['One Size']
  const colors = input.colors.length ? input.colors : ['Default']
  const rows: VariantDraft[] = []
  let index = 0

  for (const color of colors) {
    for (const size of sizes) {
      const label = colors.length > 1 && sizes.length > 1 ? `${color} / ${size}` : color || size
      rows.push({
        key: `${color}::${size}`,
        label,
        size,
        color,
        sku: buildAutoSku({
          categoryCode: input.categoryCode,
          brandCode: input.brandCode,
          color,
          size,
          index,
        }),
        barcode: '',
        purchase_price: input.purchasePrice,
        selling_price: input.sellingPrice,
        wholesale_price: input.wholesalePrice ?? null,
        opening_stock: input.openingStock ?? 0,
        is_active: true,
      })
      index += 1
    }
  }

  return rows
}

export const DEFAULT_APPAREL_SIZES = [...SIZE_PRESETS.apparel]
export const DEFAULT_COLORS = [...COLOR_PRESETS]

export function profitPreview(purchase: number, selling: number) {
  const profit = selling - purchase
  const margin = selling > 0 ? (profit / selling) * 100 : 0
  return { profit, margin }
}
