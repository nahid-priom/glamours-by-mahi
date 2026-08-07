import { describe, expect, it } from 'vitest'
import { SIDEBAR_NAV_GROUPS } from '../AppSidebar'
import { resolveBreadcrumbs } from '@/components/breadcrumbs/breadcrumb-registry'

describe('sidebar nav — no Moderator (legacy)', () => {
  it('does not expose a moderator legacy group', () => {
    expect(SIDEBAR_NAV_GROUPS.some((g) => g.id === 'moderator')).toBe(false)
    expect(SIDEBAR_NAV_GROUPS.some((g) => /legacy/i.test(g.label))).toBe(false)
  })

  it('places Order intake and New Order under My Workspace', () => {
    const staff = SIDEBAR_NAV_GROUPS.find((g) => g.id === 'staff')
    expect(staff).toBeTruthy()
    const paths = (staff?.children ?? []).map((c) => c.to)
    expect(paths).toContain('/moderator')
    expect(paths).toContain('/moderator/orders/new')
    const intake = staff?.children?.find((c) => c.to === '/moderator')
    expect(intake?.label).toBe('Order intake')
    expect(intake?.permission).toBe('moderator.dashboard.read')
  })

  it('resolves /moderator breadcrumbs under My Workspace', () => {
    const crumbs = resolveBreadcrumbs('/moderator')
    expect(crumbs?.[0]).toMatchObject({ label: 'My Workspace', to: '/staff/dashboard' })
    expect(crumbs?.[1]).toMatchObject({ label: 'Order intake' })
  })
})
