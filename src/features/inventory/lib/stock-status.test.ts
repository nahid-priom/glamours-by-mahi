import { describe, expect, it } from 'vitest'
import {
  matchesStockStatusFilter,
  resolveAvailableStockStatus,
  resolveLocationStockStatus,
} from './stock-status'

describe('stock-status', () => {
  it('classifies negative available as negative_stock', () => {
    expect(resolveAvailableStockStatus(-1, 5)).toBe('negative_stock')
  })

  it('classifies zero as out_of_stock and low when at reorder', () => {
    expect(resolveAvailableStockStatus(0, 5)).toBe('out_of_stock')
    expect(resolveAvailableStockStatus(3, 5)).toBe('low_stock')
    expect(resolveAvailableStockStatus(10, 5)).toBe('in_stock')
  })

  it('resolves location overrides', () => {
    expect(resolveLocationStockStatus('damaged', 2)).toBe('damaged')
    expect(resolveLocationStockStatus('quarantine', 1)).toBe('quarantine')
    expect(resolveLocationStockStatus('saleable', 1)).toBeNull()
  })

  it('matches filters including all', () => {
    expect(matchesStockStatusFilter('all', 0, 5)).toBe(true)
    expect(matchesStockStatusFilter('out_of_stock', 0, 5)).toBe(true)
    expect(matchesStockStatusFilter('in_stock', 0, 5)).toBe(false)
  })
})
