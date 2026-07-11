import { Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PWA_BRAND } from '../config/pwa.config'
import { usePWAOptional } from '../context/PWAProvider'

interface PWAInstallButtonProps {
  variant?: 'icon' | 'menu'
  className?: string
  onAfterClick?: () => void
}

export function PWAInstallButton({ variant = 'icon', className, onAfterClick }: PWAInstallButtonProps) {
  const pwa = usePWAOptional()

  if (!pwa?.showHeaderInstall) return null

  const isPrompting = pwa.installStatus === 'prompting'

  const handleClick = async () => {
    await pwa.promptInstall()
    onAfterClick?.()
  }

  if (variant === 'menu') {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isPrompting}
        className={cn(
          'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-[#111111] transition hover:bg-white/60',
          className,
        )}
      >
        <Download className="h-5 w-5" />
        {isPrompting ? 'Installing…' : 'Install App'}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPrompting}
      title={`Install ${PWA_BRAND.shortName} App`}
      aria-label={`Install ${PWA_BRAND.shortName} App`}
      className={cn(
        'hidden rounded-full p-2.5 transition hover:bg-white/60 sm:block',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111]/20',
        className,
      )}
    >
      <Download className="h-5 w-5" />
    </button>
  )
}
