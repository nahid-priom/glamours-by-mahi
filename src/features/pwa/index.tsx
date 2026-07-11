import { lazy, Suspense, type ReactNode } from 'react'
import { PWAInstallBanner } from './components/PWAInstallBanner'
import { PWAUpdateToast } from './components/PWAUpdateToast'
import { OfflineIndicator } from './components/OfflineIndicator'

const IOSInstallGuide = lazy(() =>
  import('./components/IOSInstallGuide').then((m) => ({ default: m.IOSInstallGuide })),
)

interface PWAStorefrontShellProps {
  children: ReactNode
}

export function PWAStorefrontShell({ children }: PWAStorefrontShellProps) {
  return (
    <>
      <PWAInstallBanner />
      {children}
      <PWAUpdateToast />
      <OfflineIndicator />
      <Suspense fallback={null}>
        <IOSInstallGuide />
      </Suspense>
    </>
  )
}

export { PWAProvider, usePWA, usePWAOptional } from './context/PWAProvider'
export { PWAInstallButton } from './components/PWAInstallButton'
export { OfflineFallbackPage } from './pages/OfflineFallbackPage'
export { PWA_BRAND } from './config/pwa.config'
