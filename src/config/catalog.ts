export const STOREFRONT_ORG_SLUG = 'glamourous-by-mahi'

export const SIZE_PRESETS = {
  free: ['Free Size'],
  apparel: ['S', 'M', 'L', 'XL', 'XXL'],
  numeric: ['28', '30', '32', '34', '36'],
  kids: ['2Y', '4Y', '6Y', '8Y', '10Y', '12Y'],
} as const

export const COLOR_PRESETS = [
  'Black',
  'White',
  'Red',
  'Blue',
  'Navy',
  'Green',
  'Maroon',
  'Beige',
  'Pink',
  'Brown',
] as const

export const SHADE_PRESETS = [
  'Ivory',
  'Warm Nude',
  'Natural Beige',
  'Rose',
  'Coral',
  'Mocha',
] as const

export const VOLUME_PRESETS = ['30ml', '50ml', '100ml', '150ml', '200ml'] as const

export type ProductKind = 'simple' | 'size_color' | 'cosmetics' | 'bundle' | 'service'

export const PRODUCT_KIND_LABELS: Record<ProductKind, string> = {
  simple: 'Simple Product',
  size_color: 'Size & Color',
  cosmetics: 'Cosmetics',
  bundle: 'Bundle',
  service: 'Service',
}

export function kindToProductType(kind: ProductKind): 'simple' | 'variable' | 'bundle' | 'service' {
  if (kind === 'size_color' || kind === 'cosmetics') return 'variable'
  if (kind === 'bundle') return 'bundle'
  if (kind === 'service') return 'service'
  return 'simple'
}

export function kindHasVariants(kind: ProductKind): boolean {
  return kind === 'size_color' || kind === 'cosmetics'
}
