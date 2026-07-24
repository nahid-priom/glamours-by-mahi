import { describe, expect, it } from 'vitest'
import { normalizePayrollFilters } from './payroll-filters'

describe('normalizePayrollFilters', () => {
  it('includes org-wide runs when branch filter is set via repository contract', () => {
    const filters = normalizePayrollFilters({ status: null }, 'branch-uuid-1')
    expect(filters.branchId).toBe('branch-uuid-1')
    expect(filters.page).toBe(1)
    expect(filters.pageSize).toBe(30)
  })

  it('allows explicit all-branches when branchId is null', () => {
    const filters = normalizePayrollFilters({ branchId: null, status: 'paid' })
    expect(filters.branchId).toBeNull()
    expect(filters.status).toBe('paid')
  })
})
