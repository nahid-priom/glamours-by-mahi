import {
  ECOMMERCE_STORE_ID,
} from '@/lib/constants'
import { customersService } from '@/features/customers/customers.service'
import { fraudService } from '@/features/fraud/fraud.service'
import { invoicesService } from '@/features/invoices/invoices.service'
import { ordersService } from '@/features/storefront/legacy-oms/orders.service'
import { productsService } from '@/features/products/products.service'
import { calcCartTotal, cartService } from './cart.service'
import type { CheckoutInput, CheckoutResult } from './storefront.types'

export const checkoutService = {
  async placeOrder(input: CheckoutInput): Promise<CheckoutResult> {
    const cart = cartService.getCart()
    if (cart.items.length === 0) {
      throw new Error('Your cart is empty')
    }

    for (const item of cart.items) {
      const product = await productsService.getProductById(item.productId)
      if (!product || product.deleted_at) {
        throw new Error(`${item.name} is no longer available`)
      }
      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${item.name}`)
      }
    }

    const { deliveryCharge, total } = calcCartTotal(cart.items)

    let customer = await customersService.getByPhone(input.phone)
    if (!customer) {
      customer = await customersService.create({
        name: input.customer_name,
        phone: input.phone,
        email: input.email ?? '',
        address: input.address,
        district: input.district,
        status: 'active',
      })
    } else {
      customer = await customersService.update(customer.id, {
        name: input.customer_name,
        email: input.email ?? customer.email,
        address: input.address,
        district: input.district,
      })
    }

    const fraudResult = await fraudService.runHybridCheck(input.phone, {
      cod_amount: total,
    })

    if (fraudResult.risk_level === 'BLOCKED') {
      throw new Error(
        'Order cannot be placed. This phone number is flagged for fraud. Please contact support.',
      )
    }

    const orderIds: string[] = []
    let primaryOrderId = ''
    let primaryOrderNumber = ''
    let invoiceId = ''
    let invoiceNo = ''

    for (let i = 0; i < cart.items.length; i++) {
      const item = cart.items[i]
      const itemTotal = item.price * item.quantity
      const codAmount = i === 0 ? itemTotal + deliveryCharge : itemTotal

      await productsService.adjustStock(item.productId, -item.quantity)

      const order = await ordersService.createOrder({
        store_id: ECOMMERCE_STORE_ID,
        customer_id: customer.id,
        customer_name: input.customer_name,
        customer_phone: input.phone,
        delivery_address: input.address,
        product_id: item.productId,
        product_name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        unit_price: item.price,
        cod_amount: codAmount,
        delivery_area: input.delivery_area,
        customer_note: input.notes,
        order_note: `Source: E-commerce Website | District: ${input.district}${input.email ? ` | Email: ${input.email}` : ''}`,
        fraud_level: fraudResult.risk_level,
        fraud_score: fraudResult.final_score,
        assigned_to: 'Order Manager',
      })

      orderIds.push(order.id)
      if (i === 0) {
        primaryOrderId = order.id
        primaryOrderNumber = order.order_id
      }

      try {
        const invoice = await invoicesService.generateFromOrder(order.id)
        if (i === 0) {
          invoiceId = invoice.id
          invoiceNo = invoice.invoice_no
        }
      } catch {
        // invoice may already exist in edge cases
      }
    }

    await customersService.recordOrderPlacement(input.phone, total)

    cartService.clearCart()

    return {
      orderIds,
      primaryOrderId,
      primaryOrderNumber,
      invoiceId,
      invoiceNo,
      fraudLevel: fraudResult.risk_level,
      fraudScore: fraudResult.final_score,
      totalCod: total,
      deliveryCharge,
    }
  },
}
