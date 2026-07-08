import type { StorefrontProduct } from '../storefront.types'

export const PRODUCT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const
export const PRODUCT_COLORS = ['Black', 'White', 'Red', 'Blue', 'Beige'] as const

export type ProductSize = (typeof PRODUCT_SIZES)[number]
export type ProductColor = (typeof PRODUCT_COLORS)[number]

export interface ProductVariantOptions {
  sizes: ProductSize[]
  colors: ProductColor[]
  disabledSizes: ProductSize[]
}

function hashString(value: string): number {
  return value.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
}

export function getProductVariantOptions(product: StorefrontProduct): ProductVariantOptions | null {
  const isAccessory = product.category === 'accessories'
  const seed = hashString(product.id)

  if (isAccessory) {
    const colors = PRODUCT_COLORS.filter((_, index) => (seed + index) % 2 === 0)
    if (colors.length === 0) return null
    return { sizes: [], colors, disabledSizes: [] }
  }

  const disabledSizes = PRODUCT_SIZES.filter((_, index) => (seed >> index) % 5 === 0)
  const colors = PRODUCT_COLORS.filter((_, index) => (seed + index) % 3 !== 0)

  if (colors.length === 0) return null

  return {
    sizes: [...PRODUCT_SIZES],
    colors,
    disabledSizes,
  }
}
