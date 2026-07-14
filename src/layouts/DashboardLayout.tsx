import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { TopHeader } from '@/components/layout/TopHeader'
import { MobileTopBar } from '@/components/layout/MobileTopBar'
import { MobileBottomNav } from '@/components/layout/MobileBottomNav'
import { Sheet, SheetContent } from '@/components/ui/sheet'

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

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
        <div className="no-print">
          <MobileTopBar onMenuClick={() => setSidebarOpen(true)} />
          <TopHeader />
        </div>

        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-20 lg:pb-6">
          <div className="mx-auto w-full max-w-[1366px] px-4 py-5 sm:px-5 sm:py-6">
            <Outlet />
          </div>
        </main>

        <div className="no-print">
          <MobileBottomNav />
        </div>
      </div>
    </div>
  )
}
