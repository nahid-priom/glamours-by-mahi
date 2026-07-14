import { useEffect, useRef } from 'react'
import { Share, PlusSquare } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { PWA_BRAND } from '../config/pwa.config'
import { usePWAOptional } from '../context/PWAProvider'

export function IOSInstallGuide() {
  const pwa = usePWAOptional()
  const triggerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (pwa?.iosGuideOpen) {
      triggerRef.current = document.activeElement as HTMLElement | null
    }
  }, [pwa?.iosGuideOpen])

  if (!pwa) return null

  return (
    <Sheet
      open={pwa.iosGuideOpen}
      onOpenChange={(open) => {
        if (!open) {
          pwa.closeIOSGuide()
          triggerRef.current?.focus()
        }
      }}
    >
      <SheetContent
        side="bottom"
        className="max-h-[88vh] overflow-y-auto rounded-t-[28px] px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader>
          <SheetTitle className="font-serif text-xl">Install {PWA_BRAND.shortName} App</SheetTitle>
          <SheetDescription>Add Glamourous by Mahi to your home screen for quick access.</SheetDescription>
        </SheetHeader>

        <ol className="mt-4 space-y-4">
          <li className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F8F6F2]">
              <Share className="h-4 w-4 text-[#111111]" />
            </span>
            <div>
              <p className="text-sm font-medium text-[#111111]">Tap the Share icon in Safari</p>
              <p className="text-xs text-[#6B7280]">At the bottom of your browser</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F8F6F2]">
              <PlusSquare className="h-4 w-4 text-[#111111]" />
            </span>
            <div>
              <p className="text-sm font-medium text-[#111111]">Select &quot;Add to Home Screen&quot;</p>
              <p className="text-xs text-[#6B7280]">Scroll down in the share menu if needed</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F8F6F2]">
              <span className="text-xs font-bold text-[#111111]">Add</span>
            </span>
            <div>
              <p className="text-sm font-medium text-[#111111]">Tap &quot;Add&quot;</p>
              <p className="text-xs text-[#6B7280]">The app icon will appear on your home screen</p>
            </div>
          </li>
        </ol>
      </SheetContent>
    </Sheet>
  )
}
