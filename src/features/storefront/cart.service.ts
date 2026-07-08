import {
  DELIVERY_CHARGE,
  FREE_DELIVERY_THRESHOLD,
} from '@/lib/constants'
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '@/lib/storage'
import type { CartItem, CartState, WishlistItem } from './storefront.types'
import type { StorefrontProduct } from './storefront.types'

const EMPTY_CART: CartState = { items: [], updatedAt: new Date().toISOString() }

function loadCart(): CartState {
  return getStorageItem<CartState>(STORAGE_KEYS.cart, EMPTY_CART)
}

function saveCart(cart: CartState): CartState {
  const next = { ...cart, updatedAt: new Date().toISOString() }
  setStorageItem(STORAGE_KEYS.cart, next)
  return next
}

function loadWishlist(): WishlistItem[] {
  return getStorageItem<WishlistItem[]>(STORAGE_KEYS.wishlist, [])
}

function saveWishlist(items: WishlistItem[]): WishlistItem[] {
  setStorageItem(STORAGE_KEYS.wishlist, items)
  return items
}

function toCartItem(product: StorefrontProduct, quantity: number): CartItem {
  return {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    sku: product.sku,
    price: product.displayPrice,
    quantity,
    image: product.image,
    alt: product.alt,
    maxStock: product.stock,
  }
}

export function calcSubtotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.price * i.quantity, 0)
}

export function calcDeliveryCharge(subtotal: number): number {
  return subtotal >= FREE_DELIVERY_THRESHOLD || subtotal === 0 ? 0 : DELIVERY_CHARGE
}

export function calcCartTotal(items: CartItem[]): {
  subtotal: number
  deliveryCharge: number
  total: number
  itemCount: number
} {
  const subtotal = calcSubtotal(items)
  const deliveryCharge = calcDeliveryCharge(subtotal)
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)
  return { subtotal, deliveryCharge, total: subtotal + deliveryCharge, itemCount }
}

export const cartService = {
  getCart(): CartState {
    return loadCart()
  },

  setCart(items: CartItem[]): CartState {
    return saveCart({ items, updatedAt: new Date().toISOString() })
  },

  addItem(product: StorefrontProduct, quantity = 1): CartState {
    const cart = loadCart()
    const existing = cart.items.find((i) => i.productId === product.id)
    const qty = Math.min(
      (existing?.quantity ?? 0) + quantity,
      product.stock,
    )

    const items = existing
      ? cart.items.map((i) =>
          i.productId === product.id ? { ...i, quantity: qty, price: product.displayPrice } : i,
        )
      : [...cart.items, toCartItem(product, Math.min(quantity, product.stock))]

    return saveCart({ ...cart, items })
  },

  updateQuantity(productId: string, quantity: number): CartState {
    const cart = loadCart()
    if (quantity <= 0) {
      return saveCart({ ...cart, items: cart.items.filter((i) => i.productId !== productId) })
    }
    const items = cart.items.map((i) =>
      i.productId === productId
        ? { ...i, quantity: Math.min(quantity, i.maxStock) }
        : i,
    )
    return saveCart({ ...cart, items })
  },

  removeItem(productId: string): CartState {
    const cart = loadCart()
    return saveCart({ ...cart, items: cart.items.filter((i) => i.productId !== productId) })
  },

  clearCart(): CartState {
    return saveCart(EMPTY_CART)
  },

  getWishlist(): WishlistItem[] {
    return loadWishlist()
  },

  toggleWishlist(productId: string, slug: string): WishlistItem[] {
    const list = loadWishlist()
    const exists = list.find((w) => w.productId === productId)
    if (exists) {
      return saveWishlist(list.filter((w) => w.productId !== productId))
    }
    return saveWishlist([{ productId, slug, addedAt: new Date().toISOString() }, ...list])
  },

  isWishlisted(productId: string): boolean {
    return loadWishlist().some((w) => w.productId === productId)
  },
}
