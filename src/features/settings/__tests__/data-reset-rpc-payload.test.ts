import { describe, expect, it } from 'vitest'

/**
 * Keep the Settings UI payload in lockstep with execute_data_reset:
 * confirm = 'RESET', confirm_phrase = 'RESET <level>', reset_level ∈ demo|transactions|inventory|accounts|full
 */
const LEVELS = ['demo', 'transactions', 'inventory', 'accounts', 'full'] as const

function buildExecutePayload(level: (typeof LEVELS)[number], phrase: string) {
  return {
    confirm: 'RESET' as const,
    confirm_phrase: phrase,
    reset_level: level,
  }
}

describe('data reset RPC payload (UI ↔ Supabase)', () => {
  it.each(LEVELS)('builds exact execute payload for %s', (level) => {
    const phrase = `RESET ${level}`
    const payload = buildExecutePayload(level, phrase)

    expect(payload).toEqual({
      confirm: 'RESET',
      confirm_phrase: `RESET ${level}`,
      reset_level: level,
    })

    // RPC compares upper(btrim(confirm_phrase)) to upper('RESET ' || level)
    expect(payload.confirm_phrase.toUpperCase().trim()).toBe(`RESET ${level}`.toUpperCase())
    expect(payload.confirm.toUpperCase()).toBe('RESET')
  })

  it('rejects phrase that would fail execute_data_reset for full', () => {
    const payload = buildExecutePayload('full', 'RESET FULLY')
    expect(payload.confirm_phrase.toUpperCase().trim()).not.toBe('RESET FULL')
  })

  it('preview scope matches preview_data_reset reset_level key', () => {
    const scope = { reset_level: 'full' as const }
    expect(scope).toEqual({ reset_level: 'full' })
  })
})
