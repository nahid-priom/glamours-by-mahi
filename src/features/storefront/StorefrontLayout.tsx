import { Outlet } from 'react-router-dom'
import { CartProvider } from './cart.context'
import { StorefrontUIProvider } from './storefront-ui.context'
import { StoreHeader } from './components/StoreHeader'
import { Footer } from './components/Footer'
import { MobileBottomNav } from './components/MobileBottomNav'
import { SearchModal } from './components/SearchModal'
import { QuickViewModal, CartDrawer } from './components/QuickViewModal'

function StorefrontShell() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-[#F8F6F2] font-sans text-[#111111]">
      <StoreHeader />
      <main className="flex-1 overflow-x-hidden pt-[72px] pb-20 lg:pb-0">
        <Outlet />
      </main>
      <Footer />
      <MobileBottomNav />
      <SearchModal />
      <QuickViewModal />
      <CartDrawer />
    </div>
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
