import { afterEach, describe, expect, it, vi } from 'vitest'
import * as chunkRecovery from './chunk-recovery'
import { importWithChunkRetry } from './lazy-with-retry'

describe('importWithChunkRetry', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the module when import succeeds', async () => {
    const factory = vi.fn().mockResolvedValue({ default: 'ok' })
    await expect(importWithChunkRetry(factory)).resolves.toEqual({ default: 'ok' })
  })

  it('attempts recovery for chunk failures', async () => {
    const chunkError = new Error('Failed to fetch dynamically imported module')
    const factory = vi.fn().mockRejectedValue(chunkError)
    const recoverSpy = vi.spyOn(chunkRecovery, 'recoverFromChunkError').mockResolvedValue('skipped')

    await expect(importWithChunkRetry(factory)).rejects.toBe(chunkError)
    expect(recoverSpy).toHaveBeenCalledTimes(1)
  })

  it('rethrows non-chunk errors without recovery', async () => {
    const runtimeError = new Error('Cannot read properties of undefined')
    const factory = vi.fn().mockRejectedValue(runtimeError)
    const recoverSpy = vi.spyOn(chunkRecovery, 'recoverFromChunkError')

    await expect(importWithChunkRetry(factory)).rejects.toBe(runtimeError)
    expect(recoverSpy).not.toHaveBeenCalled()
  })
})
