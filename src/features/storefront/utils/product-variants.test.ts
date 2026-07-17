import { describe, expect, it } from 'vitest'
import type { CartItem, StorefrontProduct } from '../storefront.types'
import {
  buildSelectionFromVariant,
  formatVariantLabel,
  getAutoSelectableVariant,
  getMissingAttributes,
  getValueAvailability,
  getVariantAttributes,
  hasUnresolvedCartItems,
  requiresVariantSelection,
  resolveVariantBySelection,
  validateCartItemVariant,
} from './product-variants'

type Variant = NonNullable<StorefrontProduct['catalogVariants']>[number]

function makeVariant(
  id: string,
  optionValues: Array<{ option: string; value: string }>,
  stock = 10,
  sellingPrice = 100,
): Variant {
  return { id, sku: `SKU-${id}`, label: id, sellingPrice, stock, optionValues }
}

function makeProduct(variants: Variant[]): StorefrontProduct {
  return { id: 'p1', catalogVariants: variants } as unknown as StorefrontProduct
}

const multiVariantProduct = makeProduct([
  makeVariant('v1', [
    { option: 'Size', value: 'M' },
    { option: 'Color', value: 'Pink' },
  ]),
  makeVariant('v2', [
    { option: 'Size', value: 'L' },
    { option: 'Color', value: 'Pink' },
  ]),
  makeVariant(
    'v3',
    [
      { option: 'Size', value: 'L' },
      { option: 'Color', value: 'Black' },
    ],
    0,
  ),
])

describe('variant attributes', () => {
  it('derives attributes only from real variant data', () => {
    const attributes = getVariantAttributes(multiVariantProduct)
    expect(attributes).toEqual([
      { name: 'Size', values: ['M', 'L'] },
      { name: 'Color', values: ['Pink', 'Black'] },
    ])
  })

  it('never invents options for products without variant data', () => {
    const simple = makeProduct([makeVariant('only', [])])
    expect(getVariantAttributes(simple)).toEqual([])
    expect(requiresVariantSelection(simple)).toBe(false)
  })

  it('requires selection when any attribute has multiple values', () => {
    expect(requiresVariantSelection(multiVariantProduct)).toBe(true)
  })

  it('does not require selection for single-value attributes', () => {
    const oneChoice = makeProduct([
      makeVariant('v1', [{ option: 'Volume', value: '250ml' }]),
    ])
    expect(requiresVariantSelection(oneChoice)).toBe(false)
    expect(getAutoSelectableVariant(oneChoice)?.id).toBe('v1')
  })
})

describe('variant resolution', () => {
  it('resolves the exact combination', () => {
    expect(
      resolveVariantBySelection(multiVariantProduct, { Size: 'L', Color: 'Pink' })?.id,
    ).toBe('v2')
  })

  it('returns null for incomplete selection', () => {
    expect(resolveVariantBySelection(multiVariantProduct, { Size: 'L' })).toBeNull()
    expect(getMissingAttributes(multiVariantProduct, { Size: 'L' })).toEqual(['Color'])
  })

  it('returns null for combinations that do not exist', () => {
    expect(
      resolveVariantBySelection(multiVariantProduct, { Size: 'M', Color: 'Black' }),
    ).toBeNull()
  })

  it('never auto-selects when choice is required', () => {
    expect(getAutoSelectableVariant(multiVariantProduct)).toBeNull()
  })

  it('disables out-of-stock combinations', () => {
    const availability = getValueAvailability(multiVariantProduct, 'Color', { Size: 'M' })
    expect(availability).toEqual([
      { value: 'Pink', disabled: false },
      { value: 'Black', disabled: true },
    ])
  })
})

describe('labels and cart validation', () => {
  it('formats labels safely and skips missing values', () => {
    expect(
      formatVariantLabel([
        { option: 'Size', value: 'M' },
        { option: 'Color', value: 'Pink' },
        { option: '', value: 'x' },
      ]),
    ).toBe('Size: M • Color: Pink')
    expect(formatVariantLabel(undefined)).toBe('')
    expect(formatVariantLabel([])).toBe('')
  })

  it('rebuilds a selection map from a variant', () => {
    expect(buildSelectionFromVariant(multiVariantProduct.catalogVariants![1])).toEqual({
      Size: 'L',
      Color: 'Pink',
    })
  })

  it('flags cart items without a variant id for repair', () => {
    const valid = { productId: 'p1', variantId: 'v1' } as CartItem
    const invalid = { productId: 'p1' } as CartItem
    expect(validateCartItemVariant(valid)).toBe('valid')
    expect(validateCartItemVariant(invalid)).toBe('needs_options')
    expect(hasUnresolvedCartItems([valid, invalid])).toBe(true)
    expect(hasUnresolvedCartItems([valid])).toBe(false)
  })
})
