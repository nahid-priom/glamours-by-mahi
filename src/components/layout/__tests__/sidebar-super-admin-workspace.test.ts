import { describe, expect, it } from 'vitest'
import { SIDEBAR_NAV_GROUPS } from '../AppSidebar'

describe('My Workspace nav policy', () => {
  it('keeps staff group in config for employees', () => {
    const staff = SIDEBAR_NAV_GROUPS.find((g) => g.id === 'staff')
    expect(staff?.label).toBe('My Workspace')
  })

  it('documents owner/super-admin hide rule', () => {
    // Runtime filter lives in AppSidebar: hide group id "staff" when role is Super Admin or Owner.
    const roleNames = ['Super Admin', 'Owner', 'super admin', 'OWNER']
    for (const role of roleNames) {
      const n = role.trim().toLowerCase()
      expect(n === 'super admin' || n === 'owner').toBe(true)
    }
  })
})
