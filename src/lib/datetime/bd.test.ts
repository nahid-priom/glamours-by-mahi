import { describe, expect, it } from 'vitest'
import {
  addDaysYmd,
  compareYmd,
  resolveShortcut,
  startOfWeekYmd,
  toQueryBounds,
  todayYmd,
  dhakaWallToUtc,
  formatDisplayRange,
} from './bd'

describe('bd datetime SSOT', () => {
  // 2026-08-01 08:00 UTC = 14:00 Asia/Dhaka
  const fixed = new Date('2026-08-01T08:00:00.000Z')

  it('todayYmd uses Asia/Dhaka', () => {
    expect(todayYmd(fixed)).toBe('2026-08-01')
  })

  it('this_week is Sunday–Saturday containing today', () => {
    // 2026-08-01 is Saturday → week Sun 2026-07-26 .. Sat 2026-08-01
    const range = resolveShortcut('this_week', fixed)
    expect(range.from).toBe('2026-07-26')
    expect(range.to).toBe('2026-08-01')
    expect(startOfWeekYmd('2026-08-01')).toBe('2026-07-26')
  })

  it('this_month is month start through today', () => {
    expect(resolveShortcut('this_month', fixed)).toEqual({
      from: '2026-08-01',
      to: '2026-08-01',
    })
    expect(resolveShortcut('this_month', new Date('2026-08-15T06:00:00.000Z'))).toEqual({
      from: '2026-08-01',
      to: '2026-08-15',
    })
  })

  it('single day bounds are 00:01 → 23:59:59.999 Dhaka', () => {
    const { fromIso, toIso } = toQueryBounds('2026-08-01', '2026-08-01')
    expect(fromIso).toBe(dhakaWallToUtc('2026-08-01', 0, 1, 0, 0).toISOString())
    expect(toIso).toBe(dhakaWallToUtc('2026-08-01', 23, 59, 59, 999).toISOString())
    // 00:01 Dhaka = 18:01 previous day UTC
    expect(fromIso).toBe('2026-07-31T18:01:00.000Z')
    expect(toIso).toBe('2026-08-01T17:59:59.999Z')
  })

  it('swaps inverted ranges', () => {
    const { fromIso, toIso } = toQueryBounds('2026-08-10', '2026-08-01')
    expect(fromIso).toBe(toQueryBounds('2026-08-01', '2026-08-10').fromIso)
    expect(toIso).toBe(toQueryBounds('2026-08-01', '2026-08-10').toIso)
  })

  it('addDaysYmd and compare', () => {
    expect(addDaysYmd('2026-08-01', 1)).toBe('2026-08-02')
    expect(compareYmd('2026-08-01', '2026-08-02')).toBe(-1)
    expect(formatDisplayRange('2026-08-01', '2026-08-01')).toBe('01 Aug 2026')
  })
})
