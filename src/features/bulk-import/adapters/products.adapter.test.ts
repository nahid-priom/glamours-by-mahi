import { describe, expect, it } from 'vitest'
import { productsAdapter } from './products.adapter'

describe('productsAdapter variant grouping', () => {
  it('parses size/color variant rows and requires category for active', () => {
    const matrix = [
      [
        'name',
        'category',
        'brand',
        'sku',
        'barcode',
        'purchase_price',
        'selling_price',
        'opening_stock',
        'status',
        'size',
        'color',
        'variant_sku',
        'variant_barcode',
      ],
      [
        'Audit Bulk Lipstick',
        'Makeup',
        'Maybelline',
        'BULK-MLIP',
        '',
        '550',
        '850',
        '2',
        'active',
        '3.5g',
        'Ruby Red',
        'BULK-MLIP-RR-35',
        '11112222',
      ],
      [
        'Audit Bulk Lipstick',
        'Makeup',
        'Maybelline',
        'BULK-MLIP',
        '',
        '550',
        '850',
        '2',
        'active',
        '5g',
        'Ruby Red',
        'BULK-MLIP-RR-5',
        '11112223',
      ],
    ]
    const rows = productsAdapter.parseRows(matrix)
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.action !== 'error')).toBe(true)
    expect(rows[0].values.size).toBe('3.5g')
    expect(rows[1].values.color).toBe('Ruby Red')
  })

  it('rejects active rows without category', () => {
    const matrix = [
      productsAdapter.templateHeaders,
      [
        'No Category Product',
        '',
        '',
        'NC-1',
        '',
        '10',
        '20',
        '0',
        'active',
        '',
        '',
        '',
        '',
      ],
    ]
    const rows = productsAdapter.parseRows(matrix)
    expect(rows[0].action).toBe('error')
    expect(rows[0].errors.join(' ')).toMatch(/category/i)
  })

  it('rejects incomplete size/color pairs', () => {
    const matrix = [
      productsAdapter.templateHeaders,
      [
        'Partial Variant',
        'Makeup',
        '',
        'PV-1',
        '',
        '10',
        '20',
        '0',
        'draft',
        'M',
        '',
        '',
        '',
      ],
    ]
    const rows = productsAdapter.parseRows(matrix)
    expect(rows[0].action).toBe('error')
    expect(rows[0].errors.join(' ')).toMatch(/size\/volume and color\/shade/i)
  })
})
