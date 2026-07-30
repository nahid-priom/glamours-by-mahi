import { describe, expect, it } from 'vitest'
import {
  attendancePunchAllowed,
  computeLateMinutes,
  haversineMetres,
  isInsideGeofence,
} from './attendance-geo'

describe('haversineMetres', () => {
  it('returns ~0 for same point', () => {
    expect(haversineMetres(23.78, 90.41, 23.78, 90.41)).toBe(0)
  })

  it('measures roughly 50m for small offset', () => {
    // ~0.00045 deg latitude ≈ 50m
    const d = haversineMetres(23.78, 90.41, 23.78045, 90.41)
    expect(d).toBeGreaterThan(40)
    expect(d).toBeLessThan(60)
  })
})

describe('isInsideGeofence', () => {
  const fence = { lat: 23.78, lng: 90.41, radiusM: 50, maxAccuracyM: 25 }

  it('accepts accurate sample inside radius', () => {
    const r = isInsideGeofence({ lat: 23.78, lng: 90.41, accuracy: 10 }, fence)
    expect(r.ok).toBe(true)
  })

  it('rejects poor accuracy', () => {
    const r = isInsideGeofence({ lat: 23.78, lng: 90.41, accuracy: 40 }, fence)
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('poor_accuracy')
  })

  it('rejects outside radius', () => {
    const r = isInsideGeofence({ lat: 23.79, lng: 90.41, accuracy: 10 }, fence)
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('outside_radius')
  })
})

describe('computeLateMinutes', () => {
  it('returns 0 within grace', () => {
    const start = Date.parse('2026-07-30T04:00:00.000Z') // 10:00 Asia/Dhaka-ish illustrative
    expect(computeLateMinutes(start + 5 * 60_000, start, 10)).toBe(0)
  })

  it('counts minutes after grace', () => {
    const start = Date.parse('2026-07-30T04:00:00.000Z')
    expect(computeLateMinutes(start + 25 * 60_000, start, 10)).toBe(15)
  })
})

describe('attendancePunchAllowed', () => {
  it('blocks duplicate check-in', () => {
    expect(
      attendancePunchAllowed({ hasCheckIn: true, hasCheckOut: false, eventType: 'check_in' }).ok,
    ).toBe(false)
  })

  it('blocks checkout without check-in', () => {
    expect(
      attendancePunchAllowed({ hasCheckIn: false, hasCheckOut: false, eventType: 'check_out' })
        .reason,
    ).toBe('checkout_without_checkin')
  })

  it('allows first check-in', () => {
    expect(
      attendancePunchAllowed({ hasCheckIn: false, hasCheckOut: false, eventType: 'check_in' }).ok,
    ).toBe(true)
  })
})
