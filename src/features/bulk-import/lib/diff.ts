/** Blank-safe merge: only apply non-empty incoming values over existing. */
export function blankSafeMerge<T extends Record<string, unknown>>(
  existing: T,
  incoming: Partial<T>,
): Partial<T> {
  const patch: Partial<T> = {}
  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined || value === null) continue
    if (typeof value === 'string' && value.trim() === '') continue
    const prev = existing[key as keyof T]
    if (valuesEqual(prev, value)) continue
    patch[key as keyof T] = value as T[keyof T]
  }
  return patch
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a == null && b == null) return true
  if (typeof a === 'number' || typeof b === 'number') {
    return Number(a) === Number(b)
  }
  return String(a ?? '').trim() === String(b ?? '').trim()
}

export function describeDiff(patch: Record<string, unknown>): string[] {
  return Object.entries(patch).map(([k, v]) => `${k} → ${v == null ? '∅' : String(v)}`)
}

/** Mark within-file duplicate match keys: first keeps action, rest become error. */
export function markWithinFileDuplicates<T extends { matchKey: string; errors: string[]; action: string }>(
  rows: T[],
  errorMessage = 'Duplicate match key in file',
): T[] {
  const seen = new Map<string, number>()
  return rows.map((row) => {
    const key = row.matchKey.trim().toLowerCase()
    if (!key || row.action === 'error' || row.action === 'skip') return row
    const prev = seen.get(key)
    if (prev == null) {
      seen.set(key, row.errors.length)
      return row
    }
    return {
      ...row,
      action: 'error' as T['action'],
      errors: [...row.errors, errorMessage],
    }
  })
}
