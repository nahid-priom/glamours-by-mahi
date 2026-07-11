import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PWA_BRAND, PWA_ICON_PATH } from '../config/pwa.config'
import { usePWA } from '../context/PWAProvider'

export function PWAInstallBanner() {
  const { showBanner, promptInstall, dismissInstallBanner, installStatus } = usePWA()

  if (!showBanner) return null

  const isPrompting = installStatus === 'prompting'

  return (
    <div
      className="fixed left-0 right-0 top-0 z-[55] border-b border-[#111111]/8 bg-white/95 backdrop-blur-md"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      role="region"
      aria-label="Install app promotion"
    >
      <div className="mx-auto flex max-w-[1400px] min-w-0 items-center gap-3 px-4 py-2.5 sm:px-6">
        <img
          src={PWA_ICON_PATH}
          alt=""
          width={36}
          height={36}
          className="h-9 w-9 shrink-0 rounded-xl border border-[#111111]/8"
        />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[#111111]">
            Install {PWA_BRAND.shortName} App
          </p>
          <p className="hidden truncate text-xs text-[#6B7280] sm:block">
            Shop faster with an app-like experience.
          </p>
        </div>

        <button
          type="button"
          onClick={() => promptInstall()}
          disabled={isPrompting}
          className={cn(
            'shrink-0 rounded-full bg-[#111111] px-4 py-2 text-xs font-semibold text-white transition',
            'hover:bg-[#E11D48] disabled:opacity-60',
          )}
        >
          {isPrompting ? 'Installing…' : 'Install App'}
        </button>

        <button
          type="button"
          onClick={dismissInstallBanner}
          className="shrink-0 rounded-full p-2 text-[#6B7280] transition hover:bg-[#F8F6F2] hover:text-[#111111]"
          aria-label="Dismiss install banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
