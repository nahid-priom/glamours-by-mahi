import { describe, expect, it } from 'vitest'
import { generateVariantMatrix, generateVariantMatrixStrict } from './variant-matrix'

describe('generateVariantMatrixStrict', () => {
  it('returns empty array when sizes or colors are missing', () => {
    expect(
      generateVariantMatrixStrict({
        sizes: [],
        colors: ['Red'],
        purchasePrice: 100,
        sellingPrice: 200,
      }),
    ).toEqual([])

    expect(
      generateVariantMatrixStrict({
        sizes: ['M'],
        colors: [],
        purchasePrice: 100,
        sellingPrice: 200,
      }),
    ).toEqual([])
  })

  it('builds cartesian product for sizes and colors', () => {
    const rows = generateVariantMatrixStrict({
      sizes: ['S', 'M', 'L'],
      colors: ['Red', 'Blue', 'Black', 'White'],
      purchasePrice: 500,
      sellingPrice: 1200,
    })
    expect(rows).toHaveLength(12)
    expect(rows[0].size).toBe('S')
    expect(rows[0].color).toBe('Red')
  })

  it('generates six unique combinations for three shades × two sizes', () => {
    const rows = generateVariantMatrixStrict({
      sizes: ['3.5g', '5g'],
      colors: ['Ruby Red', 'Rose Pink', 'Nude Brown'],
      purchasePrice: 550,
      sellingPrice: 850,
    })
    expect(rows).toHaveLength(6)
    const keys = new Set(rows.map((r) => r.key))
    expect(keys.size).toBe(6)
    expect(rows.every((r) => Boolean(r.sku))).toBe(true)
  })
})

describe('generateVariantMatrix', () => {
  it('falls back to One Size / Default when inputs are empty', () => {
    const rows = generateVariantMatrix({
      sizes: [],
      colors: [],
      purchasePrice: 100,
      sellingPrice: 200,
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].label).toContain('Default')
  })
})
