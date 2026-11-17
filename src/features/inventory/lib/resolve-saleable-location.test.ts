import { describe, expect, it } from 'vitest'
import { pickDefaultSaleableLocation } from './resolve-saleable-location'

describe('pickDefaultSaleableLocation', () => {
  it('prefers is_default saleable location', () => {
    const pick = pickDefaultSaleableLocation([
      {
        id: 'a',
        name: 'A',
        location_type: 'saleable',
        is_active: true,
        is_default: false,
        deleted_at: null,
        created_at: '2024-01-01T00:00:00Z',
        branch_id: 'b1',
      },
      {
        id: 'b',
        name: 'B',
        location_type: 'saleable',
        is_active: true,
        is_default: true,
        deleted_at: null,
        created_at: '2024-06-01T00:00:00Z',
        branch_id: 'b1',
      },
    ])
    expect(pick?.id).toBe('b')
  })

  it('falls back to oldest created_at when no default', () => {
    const pick = pickDefaultSaleableLocation([
      {
        id: 'newer',
        name: 'Newer',
        location_type: 'saleable',
        is_active: true,
        is_default: false,
        deleted_at: null,
        created_at: '2024-06-01T00:00:00Z',
        branch_id: 'b1',
      },
      {
        id: 'older',
        name: 'Older',
        location_type: 'saleable',
        is_active: true,
        is_default: false,
        deleted_at: null,
        created_at: '2024-01-01T00:00:00Z',
        branch_id: 'b1',
      },
    ])
    expect(pick?.id).toBe('older')
  })

  it('ignores damaged and inactive locations', () => {
    const pick = pickDefaultSaleableLocation([
      {
        id: 'dmg',
        name: 'Damaged',
        location_type: 'damaged',
        is_active: true,
        is_default: true,
        deleted_at: null,
        created_at: '2024-01-01T00:00:00Z',
        branch_id: 'b1',
      },
      {
        id: 'ok',
        name: 'Saleable',
        location_type: 'saleable',
        is_active: true,
        is_default: false,
        deleted_at: null,
        created_at: '2024-02-01T00:00:00Z',
        branch_id: 'b1',
      },
    ])
    expect(pick?.id).toBe('ok')
  })
})
