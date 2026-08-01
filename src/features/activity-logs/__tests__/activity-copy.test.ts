import { describe, expect, it } from 'vitest'
import {
  activityEntityPath,
  formatActivitySentence,
  type ActivityFeedItem,
} from '../lib/activity-copy'

function item(partial: Partial<ActivityFeedItem>): ActivityFeedItem {
  return {
    id: '1',
    created_at: new Date().toISOString(),
    branch_id: null,
    branch_name: null,
    actor_id: 'a1',
    actor_name: 'Karim',
    action: 'sale.void',
    entity_type: 'sale',
    entity_id: 's1',
    reason: null,
    module: 'sales',
    before_data: null,
    after_data: { invoice_no: 'INV-9' },
    request_meta: null,
    ...partial,
  }
}

describe('activity-copy', () => {
  it('formats void sale in plain language', () => {
    expect(formatActivitySentence(item({}))).toContain('Karim')
    expect(formatActivitySentence(item({}))).toContain('INV-9')
  })

  it('links sales and products', () => {
    expect(activityEntityPath(item({}))).toBe('/sales/s1')
    expect(
      activityEntityPath(item({ entity_type: 'product', entity_id: 'p1', action: 'product.create' })),
    ).toBe('/products/p1')
  })

  it('falls back for unknown actions', () => {
    const sentence = formatActivitySentence(
      item({ action: 'custom.thing', after_data: null, reason: 'Manual note' }),
    )
    expect(sentence).toContain('Manual note')
  })
})
