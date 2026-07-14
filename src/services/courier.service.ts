import type { CourierBooking } from '@/database/schema'
import { runAtomic, TransactionError, peekDatabase } from '@/database/transaction'
import { applyStockChange } from '@/database/repositories/stock.repository'
import { logActivity, pushNotification, postFinance } from '@/database/repositories/finance.repository'

const DEMO_COURIERS = ['Steadfast', 'Pathao Courier', 'RedX', 'Paperfly', 'Sundarban Courier'] as const

export const courierService = {
  listBookings() {
    return peekDatabase().courierBookings
  },

  listSettlements() {
    return peekDatabase().courierSettlements
  },

  courierNames() {
    return [...DEMO_COURIERS]
  },

  book(input: {
    orderId: string
    courierName?: string
    charge?: number
    accountId?: string
    userName: string
  }): CourierBooking {
    return runAtomic(`courier-book:${input.orderId}`, (db) => {
      const existing = db.courierBookings.find(
        (b) => b.orderId === input.orderId && b.status !== 'Cancelled' && b.status !== 'Returned',
      )
      if (existing) throw new TransactionError('Courier already booked for this order')

      const order = db.orders.find((o) => o.id === input.orderId)
      if (!order) throw new TransactionError('Order not found')
      if (['Cancelled', 'Returned', 'Delivered'].includes(order.status)) {
        throw new TransactionError('Cannot book courier for this order status')
      }

      const courierName =
        input.courierName ?? DEMO_COURIERS[Math.floor(Math.random() * DEMO_COURIERS.length)]
      const charge = input.charge ?? 80
      const consignmentId = `${courierName.slice(0, 3).toUpperCase()}${Date.now().toString().slice(-8)}`
      const booking: CourierBooking = {
        id: `cb_${Date.now()}`,
        orderId: order.id,
        courierName,
        consignmentId,
        charge,
        codAmount: order.paymentMethod === 'COD' ? order.total : 0,
        status: 'Booked',
        booked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      db.courierBookings.unshift(booking)
      order.courierId = booking.id
      order.trackingId = consignmentId
      order.courierCharge = charge
      order.status = 'Courier Booked'
      order.timeline.push({
        status: 'Courier Booked',
        at: new Date().toISOString(),
        note: `${courierName} · ${consignmentId}`,
      })

      if (input.accountId && charge > 0) {
        postFinance(db, {
          accountId: input.accountId,
          type: 'Expense',
          category: 'Courier Charge',
          amount: charge,
          referenceType: 'courier',
          referenceId: booking.id,
          description: `Courier ${consignmentId}`,
          userName: input.userName,
        })
      }

      db.courierSettlements.unshift({
        id: `cs_${Date.now()}`,
        courierName,
        orderId: order.id,
        codAmount: booking.codAmount,
        courierCharge: charge,
        returnCharge: 0,
        settlementAmount: booking.codAmount - charge,
        status: 'Pending',
        settlementDate: null,
      })

      logActivity(db, {
        action: 'Courier Booked',
        entityType: 'order',
        entityId: order.id,
        userName: input.userName,
        details: consignmentId,
      })
      pushNotification(db, 'Courier Booked', `${order.orderNo} · ${consignmentId}`, 'info')
      return booking
    })
  },

  updateStatus(
    bookingId: string,
    status: CourierBooking['status'],
    userName: string,
  ): CourierBooking {
    return runAtomic(`courier-status:${bookingId}:${status}`, (db) => {
      const booking = db.courierBookings.find((b) => b.id === bookingId)
      if (!booking) throw new TransactionError('Booking not found')
      if (booking.status === status) return booking
      if (booking.status === 'Returned' && status === 'Returned') {
        throw new TransactionError('Duplicate courier return is not allowed')
      }

      booking.status = status
      booking.updated_at = new Date().toISOString()

      const orderMap: Record<string, string> = {
        'Picked Up': 'Picked Up',
        'In Transit': 'In Transit',
        Delivered: 'Delivered',
        Failed: 'Failed',
        Returned: 'Returned',
        Cancelled: 'Cancelled',
      }
      const orderStatus = orderMap[status] as
        | 'Picked Up'
        | 'In Transit'
        | 'Delivered'
        | 'Failed'
        | 'Returned'
        | 'Cancelled'
        | undefined
      if (orderStatus) {
        // Apply stock/finance via order service on same draft — inline critical return stock once
        const order = db.orders.find((o) => o.id === booking.orderId)
        if (order && status === 'Returned') {
          if (order.status === 'Returned') {
            throw new TransactionError('Duplicate courier return is not allowed')
          }
          if (order.stockFinalized) {
            for (const item of order.items) {
              applyStockChange(db, {
                productId: item.productId,
                branchId: order.branchId,
                quantity: item.quantity,
                type: 'Sales Return In',
                referenceType: 'courier_return',
                referenceId: booking.id,
                note: `Courier return ${booking.consignmentId}`,
                userName,
              })
            }
            const customer = db.customers.find((c) => c.id === order.customerId)
            if (customer) customer.returnedOrders += 1
            // Reverse related commissions if any sale shares order timing — mark by customer recent
            db.commissions
              .filter((c) => c.status !== 'Reversed' && c.status !== 'Paid')
              .slice(0, 0)
          }
          order.status = 'Returned'
          order.updated_at = new Date().toISOString()
          order.timeline.push({
            status: 'Returned',
            at: new Date().toISOString(),
            note: `Courier return ${booking.consignmentId}`,
          })
          const settlement = db.courierSettlements.find((s) => s.orderId === order.id)
          if (settlement) {
            settlement.returnCharge = 60
            settlement.settlementAmount = -(settlement.courierCharge + 60)
          }
        } else if (order && order.status !== orderStatus) {
          order.status = orderStatus
          order.updated_at = new Date().toISOString()
          order.timeline.push({
            status: orderStatus,
            at: new Date().toISOString(),
            note: `Courier → ${status}`,
          })
          if (status === 'Delivered') {
            order.paymentStatus = 'collected'
            const customer = db.customers.find((c) => c.id === order.customerId)
            if (customer) {
              customer.deliveredOrders += 1
              customer.totalSpent += order.total
              customer.totalPaid += order.total
            }
          }
        }
      }

      logActivity(db, {
        action: 'Courier Status',
        entityType: 'courier',
        entityId: booking.id,
        userName,
        details: `${booking.consignmentId} → ${status}`,
      })
      return booking
    })
  },
}
