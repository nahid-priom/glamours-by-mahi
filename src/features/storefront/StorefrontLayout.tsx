import { Outlet } from 'react-router-dom'
import { CartProvider } from './cart.context'
import { StorefrontUIProvider } from './storefront-ui.context'
import { StoreHeader } from './components/StoreHeader'
import { Footer } from './components/Footer'
import { MobileBottomNav } from './components/MobileBottomNav'
import { SearchModal } from './components/SearchModal'
import { QuickViewModal, CartDrawer } from './components/QuickViewModal'
import { VariantSelectionModal } from './components/VariantSelectionModal'
import { PWAStorefrontShell } from '@/features/pwa/shell/PWAStorefrontShell'
import { usePWAOptional } from '@/features/pwa/core'
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
        {/* Header is fixed: 60px row on mobile; utility bar (37px) + 72px row from sm up. */}
        <main
          className={
            'flex-1 overflow-x-hidden pb-24 lg:pb-0 ' +
            'pt-[calc(60px+var(--pwa-install-bar-height,0px)+env(safe-area-inset-top,0px))] ' +
            'sm:pt-[calc(109px+var(--pwa-install-bar-height,0px)+env(safe-area-inset-top,0px))]'
          }
        >
          <Outlet />
        </main>
        <Footer />
        <MobileBottomNav />
        <SearchModal />
        <QuickViewModal />
        <VariantSelectionModal />
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
