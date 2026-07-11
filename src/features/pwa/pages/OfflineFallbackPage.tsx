import { Link } from 'react-router-dom'
import { RefreshCw, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PWA_BRAND, PWA_ICON_PATH } from '../config/pwa.config'

export function OfflineFallbackPage() {
  const tryAgain = () => {
    if (navigator.onLine) {
      window.location.href = '/'
    } else {
      window.location.reload()
    }
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <img
        src={PWA_ICON_PATH}
        alt={PWA_BRAND.name}
        width={72}
        height={72}
        className="rounded-2xl border border-[#111111]/8 shadow-sm"
      />
      <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#111111]/5 px-3 py-1.5 text-xs font-medium text-[#6B7280]">
        <WifiOff className="h-3.5 w-3.5" />
        Offline
      </div>
      <h1 className="mt-4 font-serif text-3xl text-[#111111]">You&apos;re currently offline</h1>
      <p className="mt-2 max-w-md text-sm text-[#6B7280]">
        Check your connection and try again. Previously visited pages may still be available.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button type="button" onClick={tryAgain} className="rounded-full">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
        <Link to="/">
          <Button variant="outline" className="rounded-full">
            Return Home
          </Button>
        </Link>
      </div>
    </div>
  )
}
