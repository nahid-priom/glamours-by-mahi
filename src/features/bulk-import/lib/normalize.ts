import { normalizeBdPhone } from '@/lib/phone-utils'

/** Normalize header for alias matching. */
export function normalizeHeader(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, '_')
    .replace(/[^\w]/g, '')
}

export function parseMoney(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const n = Number(t.replace(/,/g, '').replace(/৳/g, ''))
  if (!Number.isFinite(n)) return null
  return n
}

export function parseNonNegativeNumber(raw: string): number | null {
  const n = parseMoney(raw)
  if (n == null) return null
  if (n < 0) return null
  return n
}

export function normalizePhoneField(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  return (normalizeBdPhone(t) ?? t.replace(/\D/g, '')) || null
}

/**
 * Map raw CSV headers to canonical column keys using exact + alias match.
 * Returns index map: canonicalKey → column index (-1 if missing).
 */
export function mapHeaders(
  rawHeaders: string[],
  canonical: string[],
  aliases: Record<string, string[]>,
): Record<string, number> {
  const normalized = rawHeaders.map(normalizeHeader)
  const result: Record<string, number> = {}

  for (const key of canonical) {
    let idx = normalized.indexOf(key)
    if (idx < 0) {
      const alts = aliases[key] ?? []
      for (const alt of alts) {
        idx = normalized.indexOf(normalizeHeader(alt))
        if (idx >= 0) break
      }
    }
    result[key] = idx
  }

  return result
}

export function cellAt(cells: string[], idx: number): string {
  if (idx < 0) return ''
  return (cells[idx] ?? '').trim()
}
