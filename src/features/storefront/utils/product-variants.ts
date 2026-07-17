import type { CartItem, StorefrontProduct } from '../storefront.types'

export type CatalogVariant = NonNullable<StorefrontProduct['catalogVariants']>[number]

/** Attribute name → chosen value (e.g. { Size: 'M', Color: 'Pink' }). */
export type SelectedOptions = Record<string, string>

export interface VariantAttribute {
  name: string
  values: string[]
}

export interface VariantValueAvailability {
  value: string
  disabled: boolean
}

function activeVariants(product: StorefrontProduct): CatalogVariant[] {
  return product.catalogVariants ?? []
}

/**
 * Attributes are derived only from the product's real variant data.
 * Products without configured options never show selectors.
 */
export function getVariantAttributes(product: StorefrontProduct): VariantAttribute[] {
  const byName = new Map<string, string[]>()
  for (const variant of activeVariants(product)) {
    for (const optionValue of variant.optionValues) {
      const name = optionValue.option?.trim()
      const value = optionValue.value?.trim()
      if (!name || !value) continue
      const values = byName.get(name) ?? []
      if (!values.includes(value)) values.push(value)
      byName.set(name, values)
    }
  }
  return [...byName.entries()].map(([name, values]) => ({ name, values }))
}

/** True when the customer must make at least one choice before adding. */
export function requiresVariantSelection(product: StorefrontProduct): boolean {
  return getVariantAttributes(product).some((attribute) => attribute.values.length > 1)
}

function variantMatchesSelection(
  variant: CatalogVariant,
  attributes: VariantAttribute[],
  selected: SelectedOptions,
): boolean {
  return attributes.every((attribute) => {
    const chosen = selected[attribute.name]
    if (!chosen) return false
    return variant.optionValues.some(
      (optionValue) => optionValue.option === attribute.name && optionValue.value === chosen,
    )
  })
}

/**
 * Resolve the exact variant for a complete selection.
 * Returns null when the selection is incomplete or the combination does not exist.
 */
export function resolveVariantBySelection(
  product: StorefrontProduct,
  selected: SelectedOptions,
): CatalogVariant | null {
  const variants = activeVariants(product)
  if (variants.length === 0) return null

  const attributes = getVariantAttributes(product)
  if (attributes.length === 0) {
    return variants.find((variant) => variant.stock > 0) ?? variants[0]
  }

  return variants.find((variant) => variantMatchesSelection(variant, attributes, selected)) ?? null
}

/**
 * A variant that can be added without asking the customer anything:
 * either the product has no selectable attributes, or every attribute
 * has exactly one value.
 */
export function getAutoSelectableVariant(product: StorefrontProduct): CatalogVariant | null {
  if (requiresVariantSelection(product)) return null
  const variants = activeVariants(product)
  if (variants.length === 0) return null
  return variants.find((variant) => variant.stock > 0) ?? variants[0]
}

/** Attribute names still missing from the current selection. */
export function getMissingAttributes(
  product: StorefrontProduct,
  selected: SelectedOptions,
): string[] {
  return getVariantAttributes(product)
    .filter((attribute) => !selected[attribute.name])
    .map((attribute) => attribute.name)
}

/**
 * Availability of each value for one attribute, honouring the other current
 * selections. A value is disabled when no in-stock variant matches it.
 */
export function getValueAvailability(
  product: StorefrontProduct,
  attributeName: string,
  selected: SelectedOptions,
): VariantValueAvailability[] {
  const attributes = getVariantAttributes(product)
  const attribute = attributes.find((a) => a.name === attributeName)
  if (!attribute) return []

  const others = attributes.filter((a) => a.name !== attributeName)
  return attribute.values.map((value) => {
    const candidate: SelectedOptions = { ...selected, [attributeName]: value }
    const exists = activeVariants(product).some(
      (variant) =>
        variant.stock > 0 &&
        variant.optionValues.some(
          (optionValue) => optionValue.option === attributeName && optionValue.value === value,
        ) &&
        others.every((other) => {
          const chosen = candidate[other.name]
          if (!chosen) return true
          return variant.optionValues.some(
            (optionValue) => optionValue.option === other.name && optionValue.value === chosen,
          )
        }),
    )
    return { value, disabled: !exists }
  })
}

/** "Size: M • Color: Pink" — safe against missing values. */
export function formatVariantLabel(
  optionValues: Array<{ option: string; value: string }> | null | undefined,
): string {
  if (!optionValues?.length) return ''
  return optionValues
    .filter((optionValue) => optionValue.option && optionValue.value)
    .map((optionValue) => `${optionValue.option}: ${optionValue.value}`)
    .join(' • ')
}

/** Selection map reconstructed from a variant (used to preselect the editor). */
export function buildSelectionFromVariant(
  variant: Pick<CatalogVariant, 'optionValues'> | null | undefined,
): SelectedOptions {
  const selected: SelectedOptions = {}
  for (const optionValue of variant?.optionValues ?? []) {
    if (optionValue.option && optionValue.value) selected[optionValue.option] = optionValue.value
  }
  return selected
}

export type CartItemVariantStatus = 'valid' | 'needs_options'

/**
 * Legacy/localStorage cart items may predate variant enforcement.
 * Anything without a persisted variant id must be repaired before checkout.
 */
export function validateCartItemVariant(item: CartItem): CartItemVariantStatus {
  return item.variantId ? 'valid' : 'needs_options'
}

/** True when the cart contains items that must be repaired before checkout. */
export function hasUnresolvedCartItems(items: CartItem[]): boolean {
  return items.some((item) => validateCartItemVariant(item) !== 'valid')
}
