import { describe, expect, it } from 'vitest'
import { resolveBreadcrumbs } from './breadcrumb-registry'

describe('reported route breadcrumbs', () => {
  it('resolves employee names and parent links without exposing an id', () => {
    const id = '3e3fc992-0cf5-4ad8-a13c-b1667ff07850'
    expect(resolveBreadcrumbs(`/hr/employees/${id}`, { [id]: 'Mahi Akter' })).toEqual([
      { label: 'HR & Payroll', to: '/hr' },
      { label: 'Employees', to: '/hr/employees' },
      { label: 'Mahi Akter' },
    ])
    expect(resolveBreadcrumbs(`/hr/employees/${id}`).at(-1)?.label).toBe('Employee')
  })

  it.each([
    ['/hr/commission-settings', 'Commission Settings', 'HR & Payroll'],
    ['/stores', 'Stores', 'Settings'],
    ['/reports/inventory-valuation', 'Inventory Valuation', 'Reports'],
    ['/reports/cod-settlement', 'COD Settlement', 'Reports'],
  ])('resolves %s', (path, page, parent) => {
    const crumbs = resolveBreadcrumbs(path)
    expect(crumbs[0]?.label).toBe(parent)
    expect(crumbs.at(-1)?.label).toBe(page)
  })
})
