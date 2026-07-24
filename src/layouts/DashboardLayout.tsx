import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { TopHeader } from '@/components/layout/TopHeader'
import { MobileTopBar } from '@/components/layout/MobileTopBar'
import { MobileBottomNav } from '@/components/layout/MobileBottomNav'
import { AppFooter } from '@/components/layout/AppFooter'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const chromeRef = useRef<HTMLDivElement>(null)
  const isPosRoute = location.pathname === '/sales/pos' || location.pathname === '/sales/new'

  useLayoutEffect(() => {
    const el = chromeRef.current
    if (!el) return

    const update = () => {
      const height = Math.ceil(el.getBoundingClientRect().height)
      document.documentElement.style.setProperty('--app-header-height', `${height}px`)
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.addEventListener('resize', update)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [isPosRoute])

  useEffect(() => {
    if (!isPosRoute) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isPosRoute])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden lg:block no-print">
        <AppSidebar className="fixed left-0 top-0 z-40 h-screen" />
      </div>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="z-[70] w-[260px] border-0 p-0">
          <AppSidebar onNavigate={() => setSidebarOpen(false)} className="h-full" />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col lg:ml-[260px] print:ml-0">
        <div ref={chromeRef} className="no-print shrink-0">
          <MobileTopBar onMenuClick={() => setSidebarOpen(true)} />
          <TopHeader />
        </div>

        <main
          className={cn(
            'min-h-0 flex-1 overflow-x-hidden',
            isPosRoute ? 'overflow-hidden pb-0 lg:pb-0' : 'overflow-y-auto pb-20 lg:pb-24',
          )}
        >
          <div
            className={cn(
              'mx-auto w-full max-w-[1366px]',
              isPosRoute
                ? 'h-[calc(100dvh-var(--app-header-height,4rem))] min-h-0 overflow-hidden px-3 py-2 sm:px-4'
                : 'px-4 py-5 sm:px-5 sm:py-6',
            )}
          >
            <Outlet />
          </div>
        </main>

        {!isPosRoute ? (
          <div className="no-print">
            <AppFooter />
          </div>
        ) : null}

        <div className="no-print">
          <MobileBottomNav />
        </div>
      </div>
    </div>
  )
}
