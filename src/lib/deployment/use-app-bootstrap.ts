import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import {
  clearBuildRefreshMarker,
  isNewerBuildAvailable,
  markBuildRefreshAttempted,
  readHtmlBuildId,
  storeActiveBuildId,
} from '@/lib/deployment/build-version'
import { clearChunkRecoveryMarker } from '@/lib/deployment/chunk-recovery'

const CRITICAL_FORM_ROUTES = ['/checkout', '/pos', '/sales/'] as const

function isCriticalFormRoute(pathname: string): boolean {
  return CRITICAL_FORM_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route),
  )
}

export function useAppBootstrap() {
  const location = useLocation()

  useEffect(() => {
    clearChunkRecoveryMarker()
    storeActiveBuildId()

    const htmlBuildId = readHtmlBuildId()
    if (htmlBuildId) {
      clearBuildRefreshMarker(htmlBuildId)
    }
  }, [])

  useEffect(() => {
    if (!isNewerBuildAvailable()) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) return

    const htmlBuildId = readHtmlBuildId()
    if (!htmlBuildId) return

    if (isCriticalFormRoute(location.pathname)) {
      return
    }

    if (sessionStorage.getItem(`app:build-refresh-attempted:${htmlBuildId}`) === '1') {
      return
    }

    markBuildRefreshAttempted(htmlBuildId)
    window.location.reload()
  }, [location.pathname])
}
