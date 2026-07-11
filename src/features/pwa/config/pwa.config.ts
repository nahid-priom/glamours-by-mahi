export const PWA_BRAND = {
  name: 'CODE BONDHU',
  shortName: 'Shakira',
  description: 'Premium fashion and online shopping from CODE BONDHU.',
  themeColor: '#F8F6F2',
  backgroundColor: '#F8F6F2',
  lang: 'en',
  dir: 'ltr' as const,
  categories: ['shopping', 'fashion', 'lifestyle'] as const,
} as const

export const PWA_STORAGE_KEYS = {
  installDismissedAt: 'shakira_pwa_install_dismissed_at',
} as const

/** Banner hidden for 7 days after dismiss */
export const PWA_INSTALL_DISMISS_MS = 7 * 24 * 60 * 60 * 1000

export const PWA_INSTALL_BAR_HEIGHT = 52

export const PWA_ICON_PATH = '/icons/icon-192.png'
