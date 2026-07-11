import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import type { BeforeInstallPromptEvent, PWAInstallStatus } from '../types/pwa.types'
import {
  isIOSSafari,
  isIOSDevice,
  isStandaloneDisplayMode,
  setInstallDismissedAt,
  clearInstallDismissedAt,
  shouldShowInstallPromotion,
} from '../services/pwa-storage.service'

export function usePWAInstall() {
  const location = useLocation()
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null)
  const [canInstall, setCanInstall] = useState(false)
  const [isInstalled, setIsInstalled] = useState(() => isStandaloneDisplayMode())
  const [isIOS] = useState(() => isIOSDevice())
  const [isStandalone, setIsStandalone] = useState(() => isStandaloneDisplayMode())
  const [installStatus, setInstallStatus] = useState<PWAInstallStatus>('idle')
  const [iosGuideOpen, setIOSGuideOpen] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      deferredRef.current = e as BeforeInstallPromptEvent
      setCanInstall(true)
      setInstallStatus('idle')
    }

    const onInstalled = () => {
      deferredRef.current = null
      setCanInstall(false)
      setIsInstalled(true)
      setIsStandalone(true)
      setInstallStatus('accepted')
    }

    const onDisplayMode = () => {
      const standalone = isStandaloneDisplayMode()
      setIsStandalone(standalone)
      if (standalone) setIsInstalled(true)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    window.matchMedia('(display-mode: standalone)').addEventListener('change', onDisplayMode)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
      window.matchMedia('(display-mode: standalone)').removeEventListener('change', onDisplayMode)
    }
  }, [])

  const showBanner =
    !isInstalled &&
    !isStandalone &&
    !bannerDismissed &&
    shouldShowInstallPromotion(location.pathname) &&
    (canInstall || (isIOS && isIOSSafari()))

  const showHeaderInstall =
    !isInstalled && !isStandalone && (canInstall || (isIOS && isIOSSafari()))

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable' | 'ios-guide'> => {
    if (isStandaloneDisplayMode() || isInstalled) return 'unavailable'

    if (isIOS && isIOSSafari() && !deferredRef.current) {
      setIOSGuideOpen(true)
      return 'ios-guide'
    }

    const prompt = deferredRef.current
    if (!prompt) return 'unavailable'

    setInstallStatus('prompting')
    try {
      await prompt.prompt()
      const { outcome } = await prompt.userChoice
      deferredRef.current = null
      setCanInstall(false)
      setInstallStatus(outcome === 'accepted' ? 'accepted' : 'dismissed')
      if (outcome === 'accepted') {
        setIsInstalled(true)
        setIsStandalone(true)
      }
      return outcome
    } catch {
      setInstallStatus('unavailable')
      return 'unavailable'
    }
  }, [isInstalled])

  const dismissInstallBanner = useCallback(() => {
    setInstallDismissedAt()
    setBannerDismissed(true)
  }, [])

  const resetInstallDismissal = useCallback(() => {
    clearInstallDismissedAt()
    setBannerDismissed(false)
  }, [])

  return {
    canInstall,
    isInstalled,
    isIOS,
    isStandalone,
    showBanner,
    showHeaderInstall,
    installStatus,
    iosGuideOpen,
    promptInstall,
    dismissInstallBanner,
    resetInstallDismissal,
    openIOSGuide: () => setIOSGuideOpen(true),
    closeIOSGuide: () => setIOSGuideOpen(false),
  }
}
