import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePWAOptional } from '../context/PWAProvider'

export function PWAUpdateToast() {
  const pwa = usePWAOptional()

  if (!pwa?.showUpdatePrompt) return null

  return (
    <div
      className="fixed bottom-20 left-4 right-4 z-[100] sm:bottom-6 sm:left-auto sm:right-4 sm:max-w-sm"
      role="status"
      aria-live="polite"
    >
      <div className="rounded-2xl border border-[#111111]/10 bg-white p-4 shadow-xl">
        <p className="text-sm font-semibold text-[#111111]">New version available</p>
        <p className="mt-1 text-xs text-[#6B7280]">Update now to get the latest improvements.</p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => pwa.applyUpdate()}
            disabled={pwa.isUpdating}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[#111111] px-4 py-2 text-xs font-semibold text-white',
              'hover:bg-[#E11D48] disabled:opacity-60',
            )}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', pwa.isUpdating && 'animate-spin')} />
            {pwa.isUpdating ? 'Updating…' : 'Update Now'}
          </button>
          <button
            type="button"
            onClick={() => pwa.postponeUpdate()}
            className="rounded-full border border-[#111111]/10 px-4 py-2 text-xs font-semibold text-[#6B7280] hover:border-[#111111]/25"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  )
}
