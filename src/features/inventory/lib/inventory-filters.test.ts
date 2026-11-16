import { describe, expect, it } from 'vitest'
import {
  filtersFromSearchParams,
  filtersToSearchParams,
  statusOptionsForView,
  toValuationFilters,
} from './inventory-filters'

describe('inventory-filters', () => {
  it('maps supported stock statuses into valuation filters', () => {
    const params = new URLSearchParams({
      view: 'products',
      status: 'negative_stock',
      branch: 'all',
    })
    const filters = filtersFromSearchParams(params)
    expect(filters.stockStatus).toBe('negative_stock')
    expect(toValuationFilters(filters).stockStatus).toBe('negative_stock')
  })

  it('drops unsupported overstock status', () => {
    const params = new URLSearchParams({ status: 'overstock', view: 'products' })
    const filters = filtersFromSearchParams(params)
    expect(filters.stockStatus).toBeNull()
  })

  it('disables extended statuses on branch summary view', () => {
    const opts = statusOptionsForView('branches')
    expect(opts.map((o) => o.value)).toEqual(['all'])
  })

  it('round-trips damaged include into URL', () => {
    const params = filtersToSearchParams({
      view: 'products',
      branchId: null,
      locationId: null,
      search: undefined,
      categoryId: null,
      brandId: null,
      stockStatus: 'damaged',
      includeNonSaleable: true,
      includeDamaged: true,
      includeQuarantine: false,
      supplierId: null,
      receiptFrom: null,
      receiptTo: null,
      sourceStatus: null,
      page: 1,
      sortBy: 'stock_value',
      sortDirection: 'desc',
    })
    expect(params.get('status')).toBe('damaged')
    expect(params.get('damaged')).toBe('1')
  })

  it('supports suppliers view and supplier URL params', () => {
    const params = new URLSearchParams({
      view: 'suppliers',
      supplier: 'sup-1',
      sourceStatus: 'unknown_legacy',
    })
    const filters = filtersFromSearchParams(params)
    expect(filters.view).toBe('suppliers')
    expect(filters.supplierId).toBe('sup-1')
    expect(filters.sourceStatus).toBe('unknown_legacy')
    const out = filtersToSearchParams(filters)
    expect(out.get('view')).toBe('suppliers')
    expect(out.get('supplier')).toBe('sup-1')
    expect(out.get('sourceStatus')).toBe('unknown_legacy')
  })
})
