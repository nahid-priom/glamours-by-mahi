import { describe, expect, it } from 'vitest'
import {
  generateBaseBarcode,
  generateBaseSku,
  skuPrefixFromProductName,
} from './product-identifiers'

describe('skuPrefixFromProductName', () => {
  it('uses first two letters from the product name', () => {
    expect(skuPrefixFromProductName('Blue Shirt')).toBe('BL')
    expect(skuPrefixFromProductName('iPhone Case')).toBe('IP')
  })

  it('pads a single character name', () => {
    expect(skuPrefixFromProductName('A')).toBe('AX')
  })

  it('falls back when name has no letters', () => {
    expect(skuPrefixFromProductName('  ')).toBe('PR')
  })
})

describe('generateBaseSku', () => {
  it('starts with the name prefix and adds a numeric suffix', () => {
    const sku = generateBaseSku('Denim Jacket')
    expect(sku).toMatch(/^DE\d{4}$/)
  })
})

describe('generateBaseBarcode', () => {
  it('returns an 8-digit numeric string', () => {
    const barcode = generateBaseBarcode()
    expect(barcode).toMatch(/^\d{8}$/)
  })
})
