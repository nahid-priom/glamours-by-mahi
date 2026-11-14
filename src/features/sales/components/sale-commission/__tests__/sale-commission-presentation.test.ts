import { describe, expect, it } from 'vitest'
import {
  buildCommissionTimeline,
  commissionStatusLabel,
  contributorLabel,
} from '../sale-commission-presentation'

describe('sale-commission-presentation', () => {
  it('prefers employee label with code', () => {
    expect(
      contributorLabel({
        employee_name: 'Asha',
        employee_code: 'E01',
        profile_name: 'Profile',
      }),
    ).toBe('Asha (E01)')
  })

  it('labels partial reverse', () => {
    expect(commissionStatusLabel('paid', 50)).toBe('Partially reversed')
    expect(commissionStatusLabel('reversed', 50)).toBe('Reversed')
  })

  it('builds timeline sorted by time', () => {
    const events = buildCommissionTimeline([
      {
        id: 'c1',
        profile_id: null,
        employee_id: 'e1',
        base_amount: 100,
        commission_amount: 10,
        reversed_amount: 2,
        original_commission_amount: 12,
        recoverable_amount: 0,
        status: 'paid',
        rule_snapshot: null,
        notes: null,
        created_at: '2026-01-02T10:00:00Z',
        approved_at: '2026-01-03T10:00:00Z',
        paid_at: '2026-01-04T10:00:00Z',
        profile_name: null,
        employee_name: 'Asha',
        employee_code: 'E01',
      },
    ])
    expect(events.map((e) => e.id)).toEqual([
      'c1-accrued',
      'c1-approved',
      'c1-paid',
      'c1-reversed',
    ])
  })
})
