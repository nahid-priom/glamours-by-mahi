import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import type { PWAUpdateState } from '../types/pwa.types'
import { isCheckoutRoute } from '../services/pwa-storage.service'

export function usePWAUpdate() {
  const location = useLocation()
  const updateSWRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null)
  const [state, setState] = useState<PWAUpdateState>({
    needRefresh: false,
    offlineReady: false,
    isUpdating: false,
    showUpdatePrompt: false,
  })
  const [postponed, setPostponed] = useState(false)

  useEffect(() => {
    if (import.meta.env.DEV) return

    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        setState((s) => ({ ...s, needRefresh: true }))
        setPostponed(false)
      },
      onOfflineReady() {
        setState((s) => ({ ...s, offlineReady: true }))
      },
      onRegistered(registration) {
        if (registration) {
          registration.update().catch(() => undefined)
        }
      },
      onRegisterError(error) {
        console.error('[PWA] Service worker registration failed:', error)
      },
    })

    updateSWRef.current = updateSW
  }, [])

  const showUpdatePrompt =
    state.needRefresh &&
    !postponed &&
    !isCheckoutRoute(location.pathname)

  const applyUpdate = useCallback(async () => {
    if (!updateSWRef.current || state.isUpdating) return
    setState((s) => ({ ...s, isUpdating: true }))
    try {
      await updateSWRef.current(true)
    } finally {
      setState((s) => ({ ...s, isUpdating: false, needRefresh: false }))
    }
  }, [state.isUpdating])

  const postponeUpdate = useCallback(() => {
    setPostponed(true)
  }, [])

  return {
    ...state,
    showUpdatePrompt,
    applyUpdate,
    postponeUpdate,
  }
}
