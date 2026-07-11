import { PWA_INSTALL_DISMISS_MS, PWA_STORAGE_KEYS } from '../config/pwa.config'

export function getInstallDismissedAt(): number | null {
  try {
    const raw = localStorage.getItem(PWA_STORAGE_KEYS.installDismissedAt)
    if (!raw) return null
    const ts = Number(raw)
    return Number.isFinite(ts) ? ts : null
  } catch {
    return null
  }
}

export function setInstallDismissedAt(timestamp = Date.now()): void {
  localStorage.setItem(PWA_STORAGE_KEYS.installDismissedAt, String(timestamp))
}

export function clearInstallDismissedAt(): void {
  localStorage.removeItem(PWA_STORAGE_KEYS.installDismissedAt)
}

export function isInstallBannerDismissed(): boolean {
  const dismissedAt = getInstallDismissedAt()
  if (!dismissedAt) return false
  return Date.now() - dismissedAt < PWA_INSTALL_DISMISS_MS
}

export function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    Boolean(window.navigator.standalone)
  )
}

export function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window)
}

export function isIOSSafari(): boolean {
  if (!isIOSDevice()) return false
  const ua = navigator.userAgent
  return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
}

export function isCheckoutRoute(pathname: string): boolean {
  return pathname === '/checkout' || pathname.startsWith('/checkout/')
}

export function shouldShowInstallPromotion(pathname: string): boolean {
  if (isStandaloneDisplayMode()) return false
  if (isCheckoutRoute(pathname)) return false
  if (isInstallBannerDismissed()) return false
  return true
}
