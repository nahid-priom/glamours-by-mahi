/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearAppCachesSafely,
  clearChunkRecoveryMarker,
  hasChunkRecoveryBeenAttempted,
  isChunkLoadError,
  markChunkRecoveryAttempted,
  recoverFromChunkError,
} from './chunk-recovery'

vi.mock('./build-version', () => ({
  APP_BUILD_ID: 'test-build',
}))

describe('isChunkLoadError', () => {
  it('recognizes common deployment chunk failures', () => {
    expect(
      isChunkLoadError(
        new Error('Failed to fetch dynamically imported module: https://example.com/assets/StorefrontLayout-abc.js'),
      ),
    ).toBe(true)
    expect(isChunkLoadError(new Error('Importing a module script failed.'))).toBe(true)
    expect(isChunkLoadError(new Error('Loading chunk 123 failed.'))).toBe(true)
    expect(
      isChunkLoadError(
        new Error(
          "Expected a JavaScript module script but the server responded with a MIME type of \"text/html\"",
        ),
      ),
    ).toBe(true)
  })

  it('does not treat unrelated runtime errors as chunk failures', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false)
    expect(isChunkLoadError(new TypeError('x is not a function'))).toBe(false)
  })
})

describe('chunk recovery markers', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.stubGlobal('location', { pathname: '/shop', reload: vi.fn() })
    vi.stubGlobal('navigator', { onLine: true })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('marks and clears one-time retry state per build and path', () => {
    expect(hasChunkRecoveryBeenAttempted()).toBe(false)
    markChunkRecoveryAttempted()
    expect(hasChunkRecoveryBeenAttempted()).toBe(true)
    clearChunkRecoveryMarker()
    expect(hasChunkRecoveryBeenAttempted()).toBe(false)
  })
})

describe('recoverFromChunkError', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.stubGlobal('location', { pathname: '/', reload: vi.fn() })
    vi.stubGlobal('navigator', { onLine: true, serviceWorker: undefined })
    vi.stubGlobal('caches', {
      keys: vi.fn().mockResolvedValue(['workbox-precache-v2', 'html-shell', 'other-cache']),
      delete: vi.fn().mockResolvedValue(true),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reloads once for recognized chunk failures', async () => {
    const result = await recoverFromChunkError()
    expect(result).toBe('reloaded')
    expect(window.location.reload).toHaveBeenCalledTimes(1)
    expect(hasChunkRecoveryBeenAttempted()).toBe(true)
  })

  it('does not reload twice for the same path and build', async () => {
    markChunkRecoveryAttempted()
    const result = await recoverFromChunkError()
    expect(result).toBe('skipped')
    expect(window.location.reload).not.toHaveBeenCalled()
  })

  it('does not reload while offline', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    const result = await recoverFromChunkError()
    expect(result).toBe('skipped')
    expect(window.location.reload).not.toHaveBeenCalled()
  })
})

describe('clearAppCachesSafely', () => {
  it('removes only application-owned caches', async () => {
    const keys = vi.fn().mockResolvedValue(['workbox-precache-v2', 'html-shell', 'app-chunks', 'other'])
    const del = vi.fn().mockResolvedValue(true)
    vi.stubGlobal('caches', { keys, delete: del })

    await clearAppCachesSafely()

    expect(del).toHaveBeenCalledWith('workbox-precache-v2')
    expect(del).toHaveBeenCalledWith('html-shell')
    expect(del).toHaveBeenCalledWith('app-chunks')
    expect(del).not.toHaveBeenCalledWith('other')

    vi.unstubAllGlobals()
  })
})
