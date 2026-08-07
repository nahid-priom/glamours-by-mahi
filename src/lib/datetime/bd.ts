/** Bangladesh Standard Time — SSOT for calendar days and query bounds. */
export const BD_TZ = 'Asia/Dhaka'
/** Fixed offset: Asia/Dhaka has no DST. */
export const BD_OFFSET_MS = 6 * 60 * 60 * 1000

export type DateShortcut = 'today' | 'this_week' | 'this_month'

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/

export function isYmd(value: string | null | undefined): value is string {
  return typeof value === 'string' && YMD_RE.test(value)
}

/** Calendar date (YYYY-MM-DD) for an instant in Asia/Dhaka. */
export function ymdInDhaka(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BD_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function todayYmd(now: Date = new Date()): string {
  return ymdInDhaka(now)
}

export function parseYmd(ymd: string): { y: number; m: number; d: number } {
  const [y, m, d] = ymd.split('-').map(Number)
  return { y, m, d }
}

export function formatYmd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Add calendar days to a YMD (Gregorian, timezone-agnostic). */
export function addDaysYmd(ymd: string, days: number): string {
  const { y, m, d } = parseYmd(ymd)
  const utc = new Date(Date.UTC(y, m - 1, d + days))
  return formatYmd(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate())
}

/** Sunday-start week containing `ymd` (BD locale). */
export function startOfWeekYmd(ymd: string): string {
  const { y, m, d } = parseYmd(ymd)
  const utc = new Date(Date.UTC(y, m - 1, d))
  const dow = utc.getUTCDay() // 0=Sun
  return addDaysYmd(ymd, -dow)
}

export function endOfWeekYmd(ymd: string): string {
  return addDaysYmd(startOfWeekYmd(ymd), 6)
}

export function startOfMonthYmd(ymd: string): string {
  const { y, m } = parseYmd(ymd)
  return formatYmd(y, m, 1)
}

export function endOfMonthYmd(ymd: string): string {
  const { y, m } = parseYmd(ymd)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return formatYmd(y, m, last)
}

export function compareYmd(a: string, b: string): number {
  if (a === b) return 0
  return a < b ? -1 : 1
}

export function minYmd(a: string, b: string): string {
  return compareYmd(a, b) <= 0 ? a : b
}

export function maxYmd(a: string, b: string): string {
  return compareYmd(a, b) >= 0 ? a : b
}

export function resolveShortcut(
  shortcut: DateShortcut,
  now: Date = new Date(),
): { from: string; to: string } {
  const today = todayYmd(now)
  if (shortcut === 'today') return { from: today, to: today }
  if (shortcut === 'this_week') {
    return { from: startOfWeekYmd(today), to: endOfWeekYmd(today) }
  }
  return { from: startOfMonthYmd(today), to: today }
}

/**
 * Wall-clock time in Asia/Dhaka → UTC Date.
 * Dhaka is fixed UTC+6 (no DST).
 */
export function dhakaWallToUtc(
  ymd: string,
  hours: number,
  minutes: number,
  seconds = 0,
  ms = 0,
): Date {
  const { y, m, d } = parseYmd(ymd)
  return new Date(Date.UTC(y, m - 1, d, hours, minutes, seconds, ms) - BD_OFFSET_MS)
}

/**
 * Query bounds for inclusive Dhaka calendar days.
 * Single day / range start: 00:01:00.000 · end: 23:59:59.999 (Asia/Dhaka).
 */
export function toQueryBounds(
  fromYmd: string | null | undefined,
  toYmd?: string | null,
): { fromIso: string | null; toIso: string | null } {
  if (!fromYmd || !isYmd(fromYmd)) return { fromIso: null, toIso: null }
  let from = fromYmd
  let to = toYmd && isYmd(toYmd) ? toYmd : fromYmd
  if (compareYmd(from, to) > 0) {
    const tmp = from
    from = to
    to = tmp
  }
  return {
    fromIso: dhakaWallToUtc(from, 0, 1, 0, 0).toISOString(),
    toIso: dhakaWallToUtc(to, 23, 59, 59, 999).toISOString(),
  }
}

/** Display label e.g. 01 Aug 2026 */
export function formatDisplayYmd(ymd: string | null | undefined): string {
  if (!ymd || !isYmd(ymd)) return 'Select date'
  const { y, m, d } = parseYmd(ymd)
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  return `${String(d).padStart(2, '0')} ${months[m - 1]} ${y}`
}

export function formatDisplayRange(from: string | null | undefined, to: string | null | undefined): string {
  if (!from && !to) return 'Select dates'
  if (from && to && from === to) return formatDisplayYmd(from)
  if (from && to) return `${formatDisplayYmd(from)} – ${formatDisplayYmd(to)}`
  return formatDisplayYmd(from ?? to)
}

/** Days in month grid: leading nulls for Sunday-start week. */
export function monthGrid(ymd: string): Array<string | null> {
  const { y, m } = parseYmd(ymd)
  const first = formatYmd(y, m, 1)
  const { y: fy, m: fm, d: fd } = parseYmd(first)
  const firstDow = new Date(Date.UTC(fy, fm - 1, fd)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const cells: Array<string | null> = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) cells.push(formatYmd(y, m, day))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function shiftMonth(ymd: string, delta: number): string {
  const { y, m } = parseYmd(ymd)
  const utc = new Date(Date.UTC(y, m - 1 + delta, 1))
  return formatYmd(utc.getUTCFullYear(), utc.getUTCMonth() + 1, 1)
}
