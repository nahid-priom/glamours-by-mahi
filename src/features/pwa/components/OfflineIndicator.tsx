import { WifiOff } from 'lucide-react'
import { usePWAOptional } from '../context/PWAProvider'

export function OfflineIndicator() {
  const pwa = usePWAOptional()

  if (!pwa || pwa.isOnline) return null

  return (
    <div
      className="fixed bottom-[4.75rem] left-4 right-4 z-[90] lg:bottom-4 lg:left-auto lg:right-4 lg:max-w-md"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 rounded-full border border-[#111111]/10 bg-[#111111] px-4 py-2.5 text-xs font-medium text-white shadow-lg">
        <WifiOff className="h-4 w-4 shrink-0" />
        <span>You&apos;re offline. Some features may be unavailable.</span>
      </div>
    </div>
  )
}
