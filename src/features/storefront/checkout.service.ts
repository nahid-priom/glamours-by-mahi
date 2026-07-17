import { STOREFRONT_ORG_SLUG } from '@/config/catalog'
import { fraudService } from '@/features/fraud/fraud.service'
import { calcCartTotal, cartService } from './cart.service'
import { validateCartItemVariant } from './utils/product-variants'
import type { CheckoutInput, CheckoutResult } from './storefront.types'

export interface CheckoutValidationIssue {
  code: 'VARIANT_SELECTION_REQUIRED' | 'EMPTY_CART'
  productId?: string
  message: string
}

/** Structured error the UI can translate without leaking internals. */
export class CheckoutValidationError extends Error {
  issues: CheckoutValidationIssue[]

  constructor(issues: CheckoutValidationIssue[]) {
    super(issues[0]?.message ?? 'Please review your cart before checkout.')
    this.name = 'CheckoutValidationError'
    this.issues = issues
  }
}
import {
  placeEcommerceOrder,
  type PlaceEcommerceOrderResult,
} from './repositories/storefront-orders.repository'
import { invalidateStorefrontCache } from './storefront.service'

const CHECKOUT_TXN_KEY = 'storefront:checkout:client_txn_key'

function getOrCreateClientTxnKey(): string {
  try {
    const existing = sessionStorage.getItem(CHECKOUT_TXN_KEY)
    if (existing) return existing
  } catch {
    /* ignore */
  }
  const key =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? `web-${crypto.randomUUID()}`
      : `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  try {
    sessionStorage.setItem(CHECKOUT_TXN_KEY, key)
  } catch {
    /* ignore */
  }
  return key
}

function clearClientTxnKey() {
  try {
    sessionStorage.removeItem(CHECKOUT_TXN_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * Storefront checkout — draft WEB sale + stock reservation via place_online_order.
 * Cart UI state may remain in localStorage; business records do not.
 */
export const checkoutService = {
  async placeOrder(input: CheckoutInput): Promise<CheckoutResult> {
    const cart = cartService.getCart()
    if (cart.items.length === 0) {
      throw new CheckoutValidationError([
        { code: 'EMPTY_CART', message: 'Your cart is empty.' },
      ])
    }

    const invalidItems = cart.items.filter(
      (item) => validateCartItemVariant(item) !== 'valid',
    )
    if (invalidItems.length > 0) {
      throw new CheckoutValidationError(
        invalidItems.map((item) => ({
          code: 'VARIANT_SELECTION_REQUIRED' as const,
          productId: item.productId,
          message:
            'Please choose the options for the highlighted items in your cart before checkout.',
        })),
      )
    }

    const { deliveryCharge, total } = calcCartTotal(cart.items)

    const fraudResult = await fraudService.runHybridCheck(input.phone, {
      cod_amount: total,
    })

    if (fraudResult.risk_level === 'BLOCKED') {
      throw new Error(
        'Order cannot be placed. This phone number is flagged for fraud. Please contact support.',
      )
    }

    let result: PlaceEcommerceOrderResult
    try {
      result = await placeEcommerceOrder({
        org_slug: STOREFRONT_ORG_SLUG,
        client_txn_key: getOrCreateClientTxnKey(),
        customer_name: input.customer_name.trim(),
        customer_phone: input.phone.trim(),
        customer_email: input.email?.trim() || null,
        delivery_address: input.address.trim(),
        district: input.district.trim(),
        shipping: deliveryCharge,
        note: [
          `Delivery area: ${input.delivery_area}`,
          input.notes ? `Notes: ${input.notes}` : null,
          `Fraud: ${fraudResult.risk_level} (${fraudResult.final_score})`,
        ]
          .filter(Boolean)
          .join(' | '),
        items: cart.items.map((item) => ({
          variant_id: item.variantId!,
          quantity: item.quantity,
        })),
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      // Technical details stay out of the UI; the customer only sees a
      // friendly, actionable message.
      console.error('[checkout] place order failed:', e)
      if (msg.toLowerCase().includes('variant')) {
        throw new Error('This product option is no longer available. Please update your cart.')
      }
      if (msg.includes('Insufficient') || msg.includes('available stock')) {
        throw new Error('Some items no longer have enough stock. Please update your cart.')
      }
      throw new Error('Checkout could not be completed. Please try again.')
    }

    clearClientTxnKey()
    cartService.clearCart()
    invalidateStorefrontCache()

    return {
      orderIds: [result.sale_id],
      primaryOrderId: result.sale_id,
      primaryOrderNumber: result.invoice_no,
      invoiceId: result.sale_id,
      invoiceNo: result.invoice_no,
      publicShareToken: result.public_share_token,
      fraudLevel: fraudResult.risk_level,
      fraudScore: fraudResult.final_score,
      totalCod: Number(result.grand_total ?? total),
      deliveryCharge: Number(result.shipping ?? deliveryCharge),
    }
  },
}
