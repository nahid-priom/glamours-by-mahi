import { Outlet } from 'react-router-dom'
import { CartProvider } from './cart.context'
import { StorefrontUIProvider } from './storefront-ui.context'
import { StoreHeader } from './components/StoreHeader'
import { Footer } from './components/Footer'
import { MobileBottomNav } from './components/MobileBottomNav'
import { SearchModal } from './components/SearchModal'
import { QuickViewModal, CartDrawer } from './components/QuickViewModal'
import { PWAStorefrontShell } from '@/features/pwa'
import { usePWAOptional } from '@/features/pwa'
import type { CSSProperties } from 'react'

function StorefrontShell() {
  const pwa = usePWAOptional()
  const installBarHeight = pwa?.installBarHeight ?? 0

  const layoutStyle = {
    '--pwa-install-bar-height': `${installBarHeight}px`,
  } as CSSProperties

  return (
    <PWAStorefrontShell>
      <div
        className="flex min-h-screen flex-col overflow-x-hidden bg-[var(--sf-bg)] font-sans text-[var(--sf-ink)]"
        style={layoutStyle}
      >
        <StoreHeader />
        <main
          className="flex-1 overflow-x-hidden pb-24 lg:pb-0"
          style={{
            paddingTop: `calc(108px + var(--pwa-install-bar-height, 0px) + env(safe-area-inset-top, 0px))`,
          }}
        >
          <Outlet />
        </main>
        <Footer />
        <MobileBottomNav />
        <SearchModal />
        <QuickViewModal />
        <CartDrawer />
      </div>
    </PWAStorefrontShell>
  )
}

export function StorefrontLayout() {
  return (
    <CartProvider>
      <StorefrontUIProvider>
        <StorefrontShell />
      </StorefrontUIProvider>
    </CartProvider>
  )
}
