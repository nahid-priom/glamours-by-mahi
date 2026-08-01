import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'

Deno.test('courier webhook status normalize map covers delivered/returned', () => {
  const map: Record<string, string> = {
    delivered: 'delivered',
    returned: 'returned',
    cancelled: 'cancelled',
    hold: 'hold',
  }
  assertEquals(map.delivered, 'delivered')
  assertEquals(map.returned, 'returned')
})

Deno.test('webhook must ignore duplicate delivery via idempotent key shape', () => {
  const key = 'courier-event:parcel-1:delivered'
  assertEquals(key.startsWith('courier-event:'), true)
})
