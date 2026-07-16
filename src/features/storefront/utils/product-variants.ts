import type { StorefrontProduct } from '../storefront.types'

export const PRODUCT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const
export const PRODUCT_COLORS = ['Black', 'White', 'Red', 'Blue', 'Beige'] as const

export type ProductSize = (typeof PRODUCT_SIZES)[number]
export type ProductColor = (typeof PRODUCT_COLORS)[number]

export interface ProductVariantOptions {
  sizes: string[]
  colors: string[]
  disabledSizes: string[]
}

function hashString(value: string): number {
  return value.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
}

export function getProductVariantOptions(product: StorefrontProduct): ProductVariantOptions | null {
  if (product.catalogSizes?.length || product.catalogColors?.length) {
    const sizes = product.catalogSizes ?? []
    const colors = product.catalogColors ?? []
    if (!sizes.length && !colors.length) return null
    const disabledSizes = sizes.filter((size) => {
      const hasStock = (product.catalogVariants ?? []).some(
        (v) =>
          v.stock > 0 &&
          v.optionValues.some((ov) => ov.value === size) &&
          (!colors.length ||
            colors.some((c) =>
              (product.catalogVariants ?? []).some(
                (vv) =>
                  vv.stock > 0 &&
                  vv.optionValues.some((o) => o.value === c) &&
                  vv.optionValues.some((o) => o.value === size),
              ),
            )),
      )
      return !hasStock
    })
    return { sizes, colors, disabledSizes }
  }

  const isAccessory = product.category === 'accessories'
  const seed = hashString(product.id)

  if (isAccessory) {
    const colors = PRODUCT_COLORS.filter((_, index) => (seed + index) % 2 === 0)
    if (colors.length === 0) return null
    return { sizes: [], colors: [...colors], disabledSizes: [] }
  }

  const disabledSizes = PRODUCT_SIZES.filter((_, index) => (seed >> index) % 5 === 0)
  const colors = PRODUCT_COLORS.filter((_, index) => (seed + index) % 3 !== 0)

  if (colors.length === 0) return null

  return {
    sizes: [...PRODUCT_SIZES],
    colors: [...colors],
    disabledSizes: [...disabledSizes],
  }
}

/** Resolve catalog variant from selected size/color (or default single variant). */
export function resolveCatalogVariant(
  product: StorefrontProduct,
  selectedSize?: string,
  selectedColor?: string,
) {
  const variants = product.catalogVariants ?? []
  if (!variants.length) return null

  if (!selectedSize && !selectedColor) {
    return variants.find((v) => v.stock > 0) ?? variants[0]
  }

  return (
    variants.find((v) => {
      const values = v.optionValues.map((o) => o.value)
      const sizeOk = !selectedSize || values.includes(selectedSize)
      const colorOk = !selectedColor || values.includes(selectedColor)
      return sizeOk && colorOk
    }) ?? null
  )
}
