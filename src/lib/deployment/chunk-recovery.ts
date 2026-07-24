import { APP_BUILD_ID } from './build-version'

const CHUNK_RETRY_KEY = 'app:chunk-recovery-attempted'
const APP_CACHE_PREFIXES = ['workbox-precache', 'html-shell', 'app-chunks'] as const

const CHUNK_ERROR_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
  /chunkloaderror/i,
  /loading chunk [\w-]+ failed/i,
  /error loading dynamically imported module/i,
  /unable to preload css/i,
  /expected a javascript module script but the server responded with a mime type of ['"]text\/html['"]/i,
] as const

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false

  const messages: string[] = []
  if (typeof error === 'string') {
    messages.push(error)
  } else if (error instanceof Error) {
    messages.push(error.message)
    if (error.name) messages.push(error.name)
    const cause = (error as Error & { cause?: unknown }).cause
    if (cause instanceof Error) messages.push(cause.message)
    else if (typeof cause === 'string') messages.push(cause)
  }

  const text = messages.join(' ')
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(text))
}

export function getChunkRetryStorageKey(): string {
  return `${CHUNK_RETRY_KEY}:${APP_BUILD_ID}:${window.location.pathname}`
}

export function hasChunkRecoveryBeenAttempted(): boolean {
  try {
    return sessionStorage.getItem(getChunkRetryStorageKey()) === '1'
  } catch {
    return false
  }
}

export function markChunkRecoveryAttempted(): void {
  try {
    sessionStorage.setItem(getChunkRetryStorageKey(), '1')
  } catch {
    // sessionStorage may be unavailable in private mode
  }
}

export function clearChunkRecoveryMarker(): void {
  try {
    sessionStorage.removeItem(getChunkRetryStorageKey())
  } catch {
    // ignore
  }
}

export async function clearAppCachesSafely(): Promise<void> {
  if (typeof caches === 'undefined') return

  const keys = await caches.keys()
  await Promise.all(
    keys
      .filter((name) => APP_CACHE_PREFIXES.some((prefix) => name.includes(prefix)))
      .map((name) => caches.delete(name)),
  )
}

export async function requestServiceWorkerUpdate(): Promise<void> {
  if (!('serviceWorker' in navigator)) return

  try {
    const registration = await navigator.serviceWorker.getRegistration()
    if (!registration) return
    await registration.update()
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
    }
  } catch {
    // service worker update is best-effort during recovery
  }
}

export async function recoverFromChunkError(): Promise<'reloaded' | 'skipped'> {
  if (typeof window === 'undefined') return 'skipped'
  if (!navigator.onLine) return 'skipped'
  if (hasChunkRecoveryBeenAttempted()) return 'skipped'

  markChunkRecoveryAttempted()
  await requestServiceWorkerUpdate()
  await clearAppCachesSafely()
  window.location.reload()
  return 'reloaded'
}
