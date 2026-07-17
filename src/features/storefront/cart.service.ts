import {
  DELIVERY_CHARGE,
  FREE_DELIVERY_THRESHOLD,
} from '@/lib/constants'
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '@/lib/storage'
import { resolveProductImage } from '@/lib/images/product-image-utils'
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

function cartKey(item: Pick<CartItem, 'productId' | 'variantId'>): string {
  return item.variantId ? `${item.productId}:${item.variantId}` : item.productId
}

export type AddToCartOptions = {
  variantId?: string
  size?: string
  color?: string
  price?: number
  sku?: string
  name?: string
  maxStock?: number
}

function toCartItem(
  product: StorefrontProduct,
  quantity: number,
  options?: AddToCartOptions,
): CartItem {
  const variant =
    (options?.variantId
      ? product.catalogVariants?.find((v) => v.id === options.variantId)
      : undefined) ?? product.catalogVariants?.[0]

  return {
    productId: product.id,
    variantId: options?.variantId ?? variant?.id,
    slug: product.slug,
    name: options?.name ?? (variant ? `${product.name} (${variant.label})` : product.name),
    sku: options?.sku ?? variant?.sku ?? product.sku,
    price: options?.price ?? variant?.sellingPrice ?? product.displayPrice,
    quantity,
    image: resolveProductImage(product),
    alt: product.alt,
    maxStock: options?.maxStock ?? variant?.stock ?? product.stock,
    size: options?.size,
    color: options?.color,
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

  addItem(product: StorefrontProduct, quantity = 1, options?: AddToCartOptions): CartState {
    const cart = loadCart()
    const draft = toCartItem(product, quantity, options)
    const key = cartKey(draft)
    const existing = cart.items.find((i) => cartKey(i) === key)
    const maxStock = draft.maxStock
    const qty = Math.min((existing?.quantity ?? 0) + quantity, maxStock)

    const items = existing
      ? cart.items.map((i) =>
          cartKey(i) === key
            ? { ...i, ...draft, quantity: qty }
            : i,
        )
      : [...cart.items, { ...draft, quantity: Math.min(quantity, maxStock) }]

    return saveCart({ ...cart, items })
  },

  updateQuantity(productId: string, quantity: number, variantId?: string): CartState {
    const cart = loadCart()
    const key = cartKey({ productId, variantId })
    if (quantity <= 0) {
      return saveCart({
        ...cart,
        items: cart.items.filter((i) => cartKey(i) !== key),
      })
    }
    const items = cart.items.map((i) =>
      cartKey(i) === key ? { ...i, quantity: Math.min(quantity, i.maxStock) } : i,
    )
    return saveCart({ ...cart, items })
  },

  removeItem(productId: string, variantId?: string): CartState {
    const cart = loadCart()
    const key = cartKey({ productId, variantId })
    return saveCart({
      ...cart,
      items: cart.items.filter((i) => cartKey(i) !== key),
    })
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
