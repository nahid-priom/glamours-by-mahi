import { describe, expect, it } from 'vitest'
import { WIZARD_STEPS, PM } from './product-module-theme'
import { catalogFiltersToListParams } from './product-filters'
import { profitPreview } from './variant-matrix'

describe('product module theme', () => {
  it('defines a four-step wizard', () => {
    expect(WIZARD_STEPS.map((s) => s.id)).toEqual(['info', 'variants', 'stock', 'review'])
    expect(PM.primary).toBe('#E11D48')
  })
})

describe('catalogFiltersToListParams status tabs', () => {
  it('maps lifecycle status filters for listing tabs', () => {
    expect(catalogFiltersToListParams({ status: 'draft', stock: 'all' }).status).toBe('draft')
    expect(catalogFiltersToListParams({ status: 'pending_approval', stock: 'all' }).status).toBe(
      'pending_approval',
    )
    expect(catalogFiltersToListParams({ status: 'active', stock: 'all' }).status).toBe('active')
    expect(catalogFiltersToListParams({ status: 'archived', stock: 'all' }).status).toBe('archived')
    expect(catalogFiltersToListParams({ status: 'all', stock: 'drafts' }).status).toBe('draft')
  })
})

describe('profitPreview', () => {
  it('handles zero retail safely', () => {
    const zero = profitPreview(100, 0)
    expect(Number.isFinite(zero.margin)).toBe(true)
    expect(zero.margin).toBe(0)
  })
})
