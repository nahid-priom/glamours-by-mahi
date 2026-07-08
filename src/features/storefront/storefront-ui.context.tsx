import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { StorefrontProduct } from './storefront.types'

interface StorefrontUIContextValue {
  searchOpen: boolean
  openSearch: () => void
  closeSearch: () => void
  quickViewProduct: StorefrontProduct | null
  openQuickView: (product: StorefrontProduct) => void
  closeQuickView: () => void
  cartOpen: boolean
  openCart: () => void
  closeCart: () => void
}

const StorefrontUIContext = createContext<StorefrontUIContextValue | null>(null)

export function StorefrontUIProvider({ children }: { children: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [quickViewProduct, setQuickViewProduct] = useState<StorefrontProduct | null>(null)
  const [cartOpen, setCartOpen] = useState(false)

  const value = useMemo<StorefrontUIContextValue>(
    () => ({
      searchOpen,
      openSearch: () => setSearchOpen(true),
      closeSearch: () => setSearchOpen(false),
      quickViewProduct,
      openQuickView: setQuickViewProduct,
      closeQuickView: () => setQuickViewProduct(null),
      cartOpen,
      openCart: () => setCartOpen(true),
      closeCart: () => setCartOpen(false),
    }),
    [searchOpen, quickViewProduct, cartOpen],
  )

  return <StorefrontUIContext.Provider value={value}>{children}</StorefrontUIContext.Provider>
}

export function useStorefrontUI() {
  const ctx = useContext(StorefrontUIContext)
  if (!ctx) throw new Error('useStorefrontUI must be used within StorefrontUIProvider')
  return ctx
}
