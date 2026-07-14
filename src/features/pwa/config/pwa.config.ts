import { brandConfig } from '@/config/brand'

export const PWA_BRAND = {
  name: brandConfig.name,
  shortName: brandConfig.shortName,
  description: brandConfig.description,
  themeColor: brandConfig.themeColor,
  backgroundColor: brandConfig.backgroundColor,
  lang: 'en',
  dir: 'ltr' as const,
  categories: ['shopping', 'fashion', 'lifestyle'] as const,
} as const

export const PWA_STORAGE_KEYS = {
  installDismissedAt: 'glamourous_pwa_install_dismissed_at',
} as const

export const PWA_INSTALL_DISMISS_MS = 7 * 24 * 60 * 60 * 1000

export const PWA_INSTALL_BAR_HEIGHT = 52

export const PWA_ICON_PATH = '/icons/icon-192.png'
