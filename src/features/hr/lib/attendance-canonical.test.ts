import { describe, expect, it } from 'vitest'
import {
  CANONICAL_TEST_VECTOR,
  canonicalizeAttendancePayload,
  hashCanonicalPayload,
} from '../../../../shared/attendance-contracts/canonical'
import { idempotencyDecision, scoreAttendanceRisk } from './attendance-geo'

describe('canonicalizeAttendancePayload', () => {
  it('produces stable sorted JSON', () => {
    const a = canonicalizeAttendancePayload(CANONICAL_TEST_VECTOR)
    const b = canonicalizeAttendancePayload({ ...CANONICAL_TEST_VECTOR })
    expect(a).toBe(b)
    expect(a.indexOf('"accuracy"')).toBeLessThan(a.indexOf('"version"'))
  })

  it('hashes deterministically', async () => {
    const h1 = await hashCanonicalPayload(CANONICAL_TEST_VECTOR)
    const h2 = await hashCanonicalPayload(CANONICAL_TEST_VECTOR)
    expect(h1).toBe(h2)
    expect(h1).toMatch(/^[a-f0-9]{64}$/)
  })
})

describe('scoreAttendanceRisk', () => {
  it('accepts clean punches', () => {
    expect(scoreAttendanceRisk({ accuracyM: 10, distanceM: 5, allowedRadiusM: 100 }).band).toBe(
      'accept',
    )
  })

  it('rejects mock + integrity failure', () => {
    expect(
      scoreAttendanceRisk({ isMocked: true, integrityFailed: true, isEmulator: true }).band,
    ).toBe('reject')
  })
})

describe('idempotencyDecision', () => {
  it('detects conflict vs replay', () => {
    expect(idempotencyDecision(null, 'abc')).toBe('new')
    expect(idempotencyDecision('abc', 'abc')).toBe('replay')
    expect(idempotencyDecision('abc', 'def')).toBe('conflict')
  })
})
