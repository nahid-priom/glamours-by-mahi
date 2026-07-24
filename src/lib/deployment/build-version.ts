declare const __APP_BUILD_ID__: string

export const APP_BUILD_ID: string =
  typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : 'development'

const ACTIVE_BUILD_KEY = 'app:active-build-id'
const BUILD_REFRESH_KEY = 'app:build-refresh-attempted'

export function readHtmlBuildId(): string | null {
  if (typeof document === 'undefined') return null
  return document.querySelector('meta[name="app-build-id"]')?.getAttribute('content') ?? null
}

export function getStoredActiveBuildId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_BUILD_KEY)
  } catch {
    return null
  }
}

export function storeActiveBuildId(buildId = APP_BUILD_ID): void {
  try {
    localStorage.setItem(ACTIVE_BUILD_KEY, buildId)
  } catch {
    // ignore
  }
}

export function hasBuildRefreshBeenAttempted(buildId: string): boolean {
  try {
    return sessionStorage.getItem(`${BUILD_REFRESH_KEY}:${buildId}`) === '1'
  } catch {
    return false
  }
}

export function markBuildRefreshAttempted(buildId: string): void {
  try {
    sessionStorage.setItem(`${BUILD_REFRESH_KEY}:${buildId}`, '1')
  } catch {
    // ignore
  }
}

export function clearBuildRefreshMarker(buildId: string): void {
  try {
    sessionStorage.removeItem(`${BUILD_REFRESH_KEY}:${buildId}`)
  } catch {
    // ignore
  }
}

export function isNewerBuildAvailable(): boolean {
  const htmlBuildId = readHtmlBuildId()
  if (!htmlBuildId || htmlBuildId === APP_BUILD_ID) return false
  const stored = getStoredActiveBuildId()
  return stored !== htmlBuildId
}
