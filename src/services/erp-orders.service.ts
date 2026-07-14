import type { Order, OrderLifecycleStatus, PaymentMethod } from '@/database/schema'
import { runAtomic, TransactionError } from '@/database/transaction'
import { applyStockChange } from '@/database/repositories/stock.repository'
import { logActivity, pushNotification } from '@/database/repositories/finance.repository'
import { peekDatabase } from '@/database/transaction'

export interface WebsiteCheckoutInput {
  customerName: string
  phone: string
  email?: string
  address: string
  district: string
  items: { productId: string; name: string; sku: string; quantity: number; unitPrice: number }[]
  deliveryCharge: number
  note?: string
}

export const erpOrdersService = {
  list() {
    return peekDatabase().orders.filter((o) => !o.deleted_at)
  },

  getById(id: string) {
    return peekDatabase().orders.find((o) => o.id === id && !o.deleted_at) ?? null
  },

  getByPhone(phone: string) {
    return this.list().filter((o) => o.customerPhone === phone)
  },

  createFromWebsite(input: WebsiteCheckoutInput): Order {
    return runAtomic(`website-order:${input.phone}:${Date.now()}`, (db) => {
      if (!input.items.length) throw new TransactionError('Cart is empty')

      let customer = db.customers.find((c) => c.phone === input.phone)
      if (!customer) {
        customer = {
          id: `cu_${Date.now()}`,
          name: input.customerName,
          phone: input.phone,
          email: input.email ?? '',
          address: input.address,
          district: input.district,
          totalOrders: 0,
          deliveredOrders: 0,
          returnedOrders: 0,
          totalSpent: 0,
          totalPaid: 0,
          currentDue: 0,
          preferredBranchId: 'br_001',
          preferredChannel: 'Website',
          status: 'active',
          created_at: new Date().toISOString(),
          deleted_at: null,
        }
        db.customers.unshift(customer)
      } else {
        customer.name = input.customerName
        customer.address = input.address
        customer.district = input.district
        if (input.email) customer.email = input.email
      }

      const branchId = 'br_001'
      const subtotal = input.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
      const total = subtotal + input.deliveryCharge
      const orderId = `ord_${Date.now()}`
      const orderNo = `GBM-W-${Date.now().toString().slice(-6)}`

      for (const item of input.items) {
        const product =
          db.products.find((p) => p.id === item.productId) ||
          db.products.find((p) => p.sku === item.sku) ||
          db.products.find((p) => p.name === item.name)
        if (!product) continue
        applyStockChange(db, {
          productId: product.id,
          branchId,
          quantity: item.quantity,
          type: 'Reserve',
          referenceType: 'order',
          referenceId: orderId,
          note: 'Website order reservation',
          reserve: true,
        })
      }

      const order: Order = {
        id: orderId,
        orderNo,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        deliveryAddress: input.address,
        district: input.district,
        branchId,
        items: input.items.map((i) => {
          const product =
            db.products.find((p) => p.id === i.productId) ||
            db.products.find((p) => p.sku === i.sku) ||
            db.products.find((p) => p.name === i.name)
          return {
            productId: product?.id ?? i.productId,
            name: i.name,
            sku: i.sku,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            total: i.unitPrice * i.quantity,
          }
        }),
        subtotal,
        deliveryCharge: input.deliveryCharge,
        total,
        paymentMethod: 'COD' as PaymentMethod,
        paymentStatus: 'pending',
        status: 'New',
        source: 'Website',
        courierId: null,
        trackingId: null,
        courierCharge: 0,
        note: input.note ?? '',
        timeline: [{ status: 'New', at: new Date().toISOString(), note: 'Order placed from website' }],
        reserved: true,
        stockFinalized: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      }

      customer.totalOrders += 1
      db.orders.unshift(order)
      logActivity(db, {
        action: 'Website Order Created',
        entityType: 'order',
        entityId: orderId,
        userName: 'Website',
        details: orderNo,
      })
      pushNotification(db, 'New Website Order', `${orderNo} · ৳${total}`, 'success')
      return order
    })
  },

  updateStatus(orderId: string, status: OrderLifecycleStatus, userName = 'Admin'): Order {
    return runAtomic(`order-status:${orderId}:${status}`, (db) => {
      const order = db.orders.find((o) => o.id === orderId)
      if (!order) throw new TransactionError('Order not found')
      if (order.status === status) return order

      // Confirm → finalize stock (release reserve + Sale Out once)
      if (status === 'Confirmed' && !order.stockFinalized) {
        for (const item of order.items) {
          applyStockChange(db, {
            productId: item.productId,
            branchId: order.branchId,
            quantity: item.quantity,
            type: 'Release Reserve',
            referenceType: 'order',
            referenceId: order.id,
            releaseReserve: true,
          })
          applyStockChange(db, {
            productId: item.productId,
            branchId: order.branchId,
            quantity: item.quantity,
            type: 'Sale Out',
            referenceType: 'order',
            referenceId: order.id,
            note: `Confirmed ${order.orderNo}`,
            userName,
          })
        }
        order.reserved = false
        order.stockFinalized = true
      }

      if (status === 'Cancelled' && order.reserved && !order.stockFinalized) {
        for (const item of order.items) {
          applyStockChange(db, {
            productId: item.productId,
            branchId: order.branchId,
            quantity: item.quantity,
            type: 'Release Reserve',
            referenceType: 'order',
            referenceId: order.id,
            releaseReserve: true,
          })
        }
        order.reserved = false
      }

      if (status === 'Returned' && order.stockFinalized) {
        for (const item of order.items) {
          applyStockChange(db, {
            productId: item.productId,
            branchId: order.branchId,
            quantity: item.quantity,
            type: 'Sales Return In',
            referenceType: 'order',
            referenceId: order.id,
            note: `Return ${order.orderNo}`,
            userName,
          })
        }
        const customer = db.customers.find((c) => c.id === order.customerId)
        if (customer) customer.returnedOrders += 1
        // Reverse commissions linked via sale id if any — website orders may not have sale commissions
      }

      if (status === 'Delivered') {
        order.paymentStatus = 'collected'
        const customer = db.customers.find((c) => c.id === order.customerId)
        if (customer) {
          customer.deliveredOrders += 1
          customer.totalSpent += order.total
          customer.totalPaid += order.total
        }
      }

      order.status = status
      order.updated_at = new Date().toISOString()
      order.timeline.push({ status, at: new Date().toISOString(), note: `Status → ${status}` })
      logActivity(db, {
        action: 'Order Status Updated',
        entityType: 'order',
        entityId: order.id,
        userName,
        details: `${order.orderNo} → ${status}`,
      })
      return order
    })
  },
}
