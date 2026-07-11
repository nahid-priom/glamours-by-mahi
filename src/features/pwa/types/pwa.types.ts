import type { RegisterSWOptions } from 'vite-plugin-pwa/types'

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

declare global {
  interface Window {
    deferredPrompt?: BeforeInstallPromptEvent
  }

  interface Navigator {
    standalone?: boolean
  }
}

export type PWAInstallStatus = 'idle' | 'prompting' | 'accepted' | 'dismissed' | 'unavailable'

export interface PWAInstallState {
  canInstall: boolean
  isInstalled: boolean
  isIOS: boolean
  isStandalone: boolean
  showBanner: boolean
  showHeaderInstall: boolean
  installStatus: PWAInstallStatus
  iosGuideOpen: boolean
}

export interface PWAUpdateState {
  needRefresh: boolean
  offlineReady: boolean
  isUpdating: boolean
  showUpdatePrompt: boolean
}

export interface PWAContextValue extends PWAInstallState, PWAUpdateState {
  isOnline: boolean
  wasOffline: boolean
  installBarHeight: number
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable' | 'ios-guide'>
  dismissInstallBanner: () => void
  resetInstallDismissal: () => void
  openIOSGuide: () => void
  closeIOSGuide: () => void
  applyUpdate: () => Promise<void>
  postponeUpdate: () => void
  registerSWOptions?: RegisterSWOptions
}

export type PWARegisterSW = (options?: RegisterSWOptions) => (reloadPage?: boolean) => Promise<void>
