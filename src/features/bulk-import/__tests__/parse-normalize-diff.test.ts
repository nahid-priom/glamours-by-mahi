import { describe, expect, it } from 'vitest'
import { parseCsv, toCsv } from '../lib/parse-csv'
import { mapHeaders, normalizeHeader, parseMoney, parseNonNegativeNumber } from '../lib/normalize'
import { blankSafeMerge, markWithinFileDuplicates, describeDiff } from '../lib/diff'

describe('parseCsv', () => {
  it('parses quoted commas and escapes', () => {
    const rows = parseCsv('name,note\n"A, B","say ""hi"""\n')
    expect(rows[0]).toEqual(['name', 'note'])
    expect(rows[1]).toEqual(['A, B', 'say "hi"'])
  })

  it('round-trips via toCsv', () => {
    const csv = toCsv(['a', 'b'], [['1', 'x,y']])
    const rows = parseCsv(csv)
    expect(rows[1]).toEqual(['1', 'x,y'])
  })
})

describe('normalize + headers', () => {
  it('maps aliases to canonical keys', () => {
    const map = mapHeaders(
      ['Product Name', 'SKU Code', 'Mobile'],
      ['name', 'sku', 'phone'],
      {
        name: ['product_name', 'product name'],
        sku: ['sku_code', 'sku code'],
        phone: ['mobile', 'cell'],
      },
    )
    expect(map.name).toBe(0)
    expect(map.sku).toBe(1)
    expect(map.phone).toBe(2)
  })

  it('normalizes headers', () => {
    expect(normalizeHeader('Purchase Price')).toBe('purchase_price')
  })

  it('parses money and rejects negatives for stock', () => {
    expect(parseMoney('৳1,250.50')).toBe(1250.5)
    expect(parseNonNegativeNumber('-1')).toBeNull()
    expect(parseNonNegativeNumber('0')).toBe(0)
  })
})

describe('diff / merge', () => {
  it('blank-safe merge skips empty incoming', () => {
    const patch = blankSafeMerge(
      { name: 'A', phone: '01711111111', email: 'a@x.com' },
      { name: 'B', phone: '', email: undefined },
    )
    expect(patch).toEqual({ name: 'B' })
  })

  it('describes diffs', () => {
    expect(describeDiff({ name: 'X' })).toEqual(['name → X'])
  })

  it('flags within-file duplicate match keys', () => {
    const rows = markWithinFileDuplicates([
      { matchKey: 'SKU-1', errors: [], action: 'create' },
      { matchKey: 'SKU-1', errors: [], action: 'create' },
      { matchKey: 'SKU-2', errors: [], action: 'update' },
    ])
    expect(rows[0].action).toBe('create')
    expect(rows[1].action).toBe('error')
    expect(rows[1].errors[0]).toMatch(/Duplicate/i)
    expect(rows[2].action).toBe('update')
  })
})
