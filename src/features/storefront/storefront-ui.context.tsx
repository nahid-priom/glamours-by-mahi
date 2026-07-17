import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { CartItem, StorefrontProduct } from './storefront.types'

export interface VariantSelectionTarget {
  product: StorefrontProduct
  /** 'add' creates a new cart row; 'change' replaces an existing one. */
  mode: 'add' | 'change'
  cartItem?: CartItem
}

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
  variantSelection: VariantSelectionTarget | null
  openVariantSelector: (target: VariantSelectionTarget) => void
  closeVariantSelector: () => void
}

const StorefrontUIContext = createContext<StorefrontUIContextValue | null>(null)

export function StorefrontUIProvider({ children }: { children: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [quickViewProduct, setQuickViewProduct] = useState<StorefrontProduct | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [variantSelection, setVariantSelection] = useState<VariantSelectionTarget | null>(null)

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
      variantSelection,
      openVariantSelector: setVariantSelection,
      closeVariantSelector: () => setVariantSelection(null),
    }),
    [searchOpen, quickViewProduct, cartOpen, variantSelection],
  )

  return <StorefrontUIContext.Provider value={value}>{children}</StorefrontUIContext.Provider>
}

export function useStorefrontUI() {
  const ctx = useContext(StorefrontUIContext)
  if (!ctx) throw new Error('useStorefrontUI must be used within StorefrontUIProvider')
  return ctx
}
