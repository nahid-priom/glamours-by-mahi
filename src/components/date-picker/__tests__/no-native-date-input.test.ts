import { describe, expect, it } from 'vitest'

/** Raw production sources under src/ (tests excluded). */
const MODULE_SOURCES = import.meta.glob('../../../**/*.{ts,tsx}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

describe('SSOT date picker — no native calendars', () => {
  it('forbids type="date" and datetime-local in production modules', () => {
    const offenders: string[] = []
    for (const [path, source] of Object.entries(MODULE_SOURCES)) {
      if (path.includes('__tests__') || path.includes('.test.') || path.includes('.spec.')) {
        continue
      }
      if (/type\s*=\s*["']date["']/.test(source) || /type\s*=\s*["']datetime-local["']/.test(source)) {
        offenders.push(path.replace(/\.\.\//g, ''))
      }
    }
    expect(offenders, `Native date inputs found:\n${offenders.join('\n')}`).toEqual([])
  })
})
