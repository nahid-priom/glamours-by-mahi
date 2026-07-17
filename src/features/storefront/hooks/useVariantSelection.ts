import { useCallback, useMemo, useState } from 'react'
import type { StorefrontProduct } from '../storefront.types'
import {
  getMissingAttributes,
  getValueAvailability,
  getVariantAttributes,
  resolveVariantBySelection,
  type SelectedOptions,
} from '../utils/product-variants'

/**
 * Single source of truth for option selection across the details page,
 * quick view, the selection modal and the cart variant editor.
 */
export function useVariantSelection(
  product: StorefrontProduct,
  initialSelection?: SelectedOptions,
) {
  const attributes = useMemo(() => getVariantAttributes(product), [product])

  const [selected, setSelected] = useState<SelectedOptions>(() => {
    const initial: SelectedOptions = {}
    for (const attribute of attributes) {
      const preset = initialSelection?.[attribute.name]
      if (preset && attribute.values.includes(preset)) {
        initial[attribute.name] = preset
      } else if (attribute.values.length === 1) {
        initial[attribute.name] = attribute.values[0]
      }
    }
    return initial
  })

  const selectValue = useCallback(
    (attributeName: string, value: string) => {
      setSelected((previous) => {
        const next: SelectedOptions = { ...previous, [attributeName]: value }
        // Drop later choices that no longer form a purchasable combination.
        const order = attributes.map((attribute) => attribute.name)
        const changedIndex = order.indexOf(attributeName)
        for (const laterName of order.slice(changedIndex + 1)) {
          const chosen = next[laterName]
          if (!chosen) continue
          const stillValid = getValueAvailability(product, laterName, next).some(
            (candidate) => candidate.value === chosen && !candidate.disabled,
          )
          if (!stillValid) delete next[laterName]
        }
        return next
      })
    },
    [attributes, product],
  )

  const missingAttributes = useMemo(
    () => getMissingAttributes(product, selected),
    [product, selected],
  )

  const selectedVariant = useMemo(
    () => (missingAttributes.length === 0 ? resolveVariantBySelection(product, selected) : null),
    [product, selected, missingAttributes],
  )

  const availability = useCallback(
    (attributeName: string) => getValueAvailability(product, attributeName, selected),
    [product, selected],
  )

  return {
    attributes,
    selected,
    selectValue,
    missingAttributes,
    selectedVariant,
    availability,
    isComplete: missingAttributes.length === 0,
  }
}

export type VariantSelection = ReturnType<typeof useVariantSelection>
