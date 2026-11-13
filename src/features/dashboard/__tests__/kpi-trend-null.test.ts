import { describe, expect, it } from 'vitest'

/** Mirrors repository pctChange: no fabricated +0% / +100% when baseline missing. */
function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

describe('dashboard trend policy', () => {
  it('returns null when prior period is zero', () => {
    expect(pctChange(100, 0)).toBeNull()
  })

  it('returns percent when prior period exists', () => {
    expect(pctChange(120, 100)).toBe(20)
  })
})
