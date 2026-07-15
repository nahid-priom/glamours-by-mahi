import { describe, expect, it } from 'vitest'
import { hasPermission, hasAnyModuleAccess, MODULE_PERMISSIONS } from './catalog'

describe('permissions', () => {
  it('grants wildcard', () => {
    expect(hasPermission(['*'], 'sales.void')).toBe(true)
  })

  it('denies missing permission', () => {
    expect(hasPermission(['sales.read'], 'sales.void')).toBe(false)
  })

  it('allows any-of list', () => {
    expect(hasPermission(['pos.create'], ['sales.read', 'pos.create'])).toBe(true)
  })

  it('maps salesperson modules', () => {
    const granted = ['dashboard.read', 'pos.create', 'sales.read', 'customers.read']
    expect(hasAnyModuleAccess(granted, 'pos')).toBe(true)
    expect(hasAnyModuleAccess(granted, 'accounts')).toBe(false)
    expect(MODULE_PERMISSIONS.accounts).toContain('accounts.read')
    expect(MODULE_PERMISSIONS.accounts).toContain('accounts.manage')
  })

  it('includes simple retail accounting permissions', () => {
    expect(hasPermission(['income.create'], 'income.create')).toBe(true)
    expect(hasPermission(['customer_due.collect'], ['accounts.post', 'customer_due.collect'])).toBe(
      true,
    )
    expect(MODULE_PERMISSIONS['due-collection']).toContain('customer_due.collect')
    expect(MODULE_PERMISSIONS['profit-loss']).toContain('profit_loss.read')
  })
})
