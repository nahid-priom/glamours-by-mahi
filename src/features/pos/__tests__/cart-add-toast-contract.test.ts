import { describe, expect, it } from 'vitest'

/** Contract for POS / moderator success toast copy used across intake UIs. */
function cartToast(label: string, qty: number) {
  return `${label} · qty ${qty}`
}

describe('cart add toast contract', () => {
  it('matches POS style label · qty N', () => {
    expect(cartToast('Silk Saree · Red', 2)).toBe('Silk Saree · Red · qty 2')
  })
})
