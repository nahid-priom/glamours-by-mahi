import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useToast } from '@/components/ui/toast'
import { PWA_BRAND, PWA_INSTALL_BAR_HEIGHT } from '../config/pwa.config'
import { usePWAInstall } from '../hooks/usePWAInstall'
import { usePWAUpdate } from '../hooks/usePWAUpdate'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import type { PWAContextValue } from '../types/pwa.types'

const PWAContext = createContext<PWAContextValue | null>(null)

interface PWAProviderProps {
  children: ReactNode
}

export function PWAProvider({ children }: PWAProviderProps) {
  const { toast } = useToast()
  const install = usePWAInstall()
  const update = usePWAUpdate()
  const online = useOnlineStatus()

  const installBarHeight = install.showBanner ? PWA_INSTALL_BAR_HEIGHT : 0

  const promptInstall = async () => {
    const result = await install.promptInstall()
    if (result === 'accepted') {
      toast(`${PWA_BRAND.shortName} App installed successfully.`)
    }
    return result
  }

  const value = useMemo<PWAContextValue>(
    () => ({
      ...install,
      ...update,
      ...online,
      installBarHeight,
      promptInstall,
      applyUpdate: update.applyUpdate,
      postponeUpdate: update.postponeUpdate,
    }),
    [install, update, online, installBarHeight],
  )

  return <PWAContext.Provider value={value}>{children}</PWAContext.Provider>
}

export function usePWA() {
  const ctx = useContext(PWAContext)
  if (!ctx) throw new Error('usePWA must be used within PWAProvider')
  return ctx
}

/** Safe hook for optional PWA context (e.g. admin layout) */
export function usePWAOptional() {
  return useContext(PWAContext)
}
