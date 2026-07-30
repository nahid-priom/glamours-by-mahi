/** Pure helpers mirroring mobile attendance geo / balance rules (unit tests). */

const EARTH_RADIUS_M = 6_371_000

export function haversineMetres(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a)) * 100) / 100
}

export function isInsideGeofence(
  sample: { lat: number; lng: number; accuracy: number },
  fence: { lat: number; lng: number; radiusM: number; maxAccuracyM: number },
): { ok: boolean; distanceM: number; reason?: string } {
  if (sample.accuracy > fence.maxAccuracyM) {
    return { ok: false, distanceM: 0, reason: 'poor_accuracy' }
  }
  const distanceM = haversineMetres(sample.lat, sample.lng, fence.lat, fence.lng)
  if (distanceM > fence.radiusM) {
    return { ok: false, distanceM, reason: 'outside_radius' }
  }
  return { ok: true, distanceM }
}

/** Minutes late after scheduled start (on_time_until grace applied). */
export function computeLateMinutes(
  serverNowMs: number,
  scheduledStartMs: number,
  onTimeUntilMinutes: number,
): number {
  const late = Math.floor((serverNowMs - scheduledStartMs) / 60_000) - onTimeUntilMinutes
  return Math.max(0, late)
}

export function attendancePunchAllowed(args: {
  hasCheckIn: boolean
  hasCheckOut: boolean
  eventType: 'check_in' | 'check_out'
}): { ok: boolean; reason?: string } {
  if (args.eventType === 'check_in' && args.hasCheckIn) {
    return { ok: false, reason: 'duplicate_check_in' }
  }
  if (args.eventType === 'check_out' && !args.hasCheckIn) {
    return { ok: false, reason: 'checkout_without_checkin' }
  }
  if (args.eventType === 'check_out' && args.hasCheckOut) {
    return { ok: false, reason: 'duplicate_check_out' }
  }
  return { ok: true }
}

/** Server-side risk bands (0–29 accept, 30–59 flag, 60–89 pending_review, 90+ reject). */
export function scoreAttendanceRisk(signals: {
  isMocked?: boolean
  isEmulator?: boolean
  integrityFailed?: boolean
  accuracyM?: number | null
  distanceM?: number | null
  allowedRadiusM?: number | null
  maxAccuracyM?: number
}): { score: number; band: 'accept' | 'flag' | 'pending_review' | 'reject' } {
  let score = 0
  if (signals.isMocked) score += 40
  if (signals.isEmulator) score += 35
  if (signals.integrityFailed) score += 50
  const maxAcc = signals.maxAccuracyM ?? 50
  if (signals.accuracyM != null && signals.accuracyM > maxAcc) score += 25
  if (
    signals.distanceM != null &&
    signals.allowedRadiusM != null &&
    signals.distanceM > signals.allowedRadiusM
  ) {
    score += 30
  }
  score = Math.min(100, score)
  if (score >= 90) return { score, band: 'reject' }
  if (score >= 60) return { score, band: 'pending_review' }
  if (score >= 30) return { score, band: 'flag' }
  return { score, band: 'accept' }
}

/** Idempotency: same key + same hash = replay OK; same key + different hash = conflict. */
export function idempotencyDecision(
  existingHash: string | null,
  incomingHash: string,
): 'new' | 'replay' | 'conflict' {
  if (existingHash == null) return 'new'
  if (existingHash === incomingHash) return 'replay'
  return 'conflict'
}
