import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { cartService, calcCartTotal, type AddToCartOptions } from './cart.service'
import type { CartItem, StorefrontProduct } from './storefront.types'

interface CartContextValue {
  items: CartItem[]
  itemCount: number
  subtotal: number
  deliveryCharge: number
  total: number
  wishlistIds: Set<string>
  addItem: (product: StorefrontProduct, qty?: number, options?: AddToCartOptions) => void
  updateQuantity: (productId: string, qty: number, variantId?: string) => void
  removeItem: (productId: string, variantId?: string) => void
  clearCart: () => void
  toggleWishlist: (productId: string, slug: string) => void
  isWishlisted: (productId: string) => boolean
  refresh: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => cartService.getCart().items)
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(
    () => new Set(cartService.getWishlist().map((w) => w.productId)),
  )

  const refresh = useCallback(() => {
    setItems(cartService.getCart().items)
    setWishlistIds(new Set(cartService.getWishlist().map((w) => w.productId)))
  }, [])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith('oms_')) refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const totals = useMemo(() => calcCartTotal(items), [items])

  const addItem = useCallback(
    (product: StorefrontProduct, qty = 1, options?: AddToCartOptions) => {
      cartService.addItem(product, qty, options)
      refresh()
    },
    [refresh],
  )

  const updateQuantity = useCallback((productId: string, qty: number, variantId?: string) => {
    cartService.updateQuantity(productId, qty, variantId)
    refresh()
  }, [refresh])

  const removeItem = useCallback((productId: string, variantId?: string) => {
    cartService.removeItem(productId, variantId)
    refresh()
  }, [refresh])

  const clearCart = useCallback(() => {
    cartService.clearCart()
    refresh()
  }, [refresh])

  const toggleWishlist = useCallback((productId: string, slug: string) => {
    cartService.toggleWishlist(productId, slug)
    refresh()
  }, [refresh])

  const isWishlisted = useCallback(
    (productId: string) => wishlistIds.has(productId),
    [wishlistIds],
  )

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      itemCount: totals.itemCount,
      subtotal: totals.subtotal,
      deliveryCharge: totals.deliveryCharge,
      total: totals.total,
      wishlistIds,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      toggleWishlist,
      isWishlisted,
      refresh,
    }),
    [items, totals, wishlistIds, addItem, updateQuantity, removeItem, clearCart, toggleWishlist, isWishlisted, refresh],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
