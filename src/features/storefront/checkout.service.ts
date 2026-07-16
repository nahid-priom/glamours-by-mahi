import { STOREFRONT_ORG_SLUG } from '@/config/catalog'
import { fraudService } from '@/features/fraud/fraud.service'
import { calcCartTotal, cartService } from './cart.service'
import type { CheckoutInput, CheckoutResult } from './storefront.types'
import {
  placeEcommerceOrder,
  type PlaceEcommerceOrderResult,
} from './repositories/storefront-orders.repository'
import { invalidateStorefrontCache } from './storefront.service'

function newClientTxnKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `web-${crypto.randomUUID()}`
  }
  return `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Storefront checkout — writes to Supabase via create_ecommerce_order RPC.
 * Cart UI state may remain in localStorage; business records do not.
 */
export const checkoutService = {
  async placeOrder(input: CheckoutInput): Promise<CheckoutResult> {
    const cart = cartService.getCart()
    if (cart.items.length === 0) {
      throw new Error('Your cart is empty')
    }

    const missingVariant = cart.items.find((i) => !i.variantId)
    if (missingVariant) {
      throw new Error(
        `${missingVariant.name} needs a size/color selection. Remove it and add it again from the product page.`,
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
        client_txn_key: newClientTxnKey(),
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
      const msg = e instanceof Error ? e.message : 'Checkout failed'
      if (msg.includes('Insufficient stock')) {
        throw new Error('এই শাখায় পর্যাপ্ত স্টক নেই।')
      }
      throw new Error(msg)
    }

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
