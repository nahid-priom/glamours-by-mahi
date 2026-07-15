import type { Order, OrderActivity } from '@/types'
import type { OrderStatus } from '@/lib/constants'
import type {
  CreateOrderInput,
  OrderFilters,
  OrderStats,
  UpdateOrderInput,
} from './orders.types'
import { generateId, generateOrderId } from '@/lib/id'
import { MOCK_ORDERS, MOCK_STORES } from '@/lib/mock-data'
import { getStorageItem, setStorageItem, STORAGE_KEYS, updateStorageItem } from '@/lib/storage'
import { customersService } from '@/features/customers/customers.service'
import { courierApiDemoService } from '@/features/couriers/courier-api-demo.service'

const delay = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms))

function migrateOrder(order: Order): Order {
  return {
    ...order,
    delivery_address: order.delivery_address ?? order.customer_address ?? '',
    order_note: order.order_note ?? order.order_task_note ?? '',
    payment_status: order.payment_status ?? 'pending',
    activity_log: order.activity_log ?? [],
  }
}

function loadOrders(): Order[] {
  const stored = getStorageItem<Order[]>(STORAGE_KEYS.orders, [])
  if (stored.length === 0) {
    const seeded = MOCK_ORDERS.map(migrateOrder)
    setStorageItem(STORAGE_KEYS.orders, seeded)
    return seeded
  }
  return stored.map(migrateOrder)
}

function saveOrders(orders: Order[]): Order[] {
  setStorageItem(STORAGE_KEYS.orders, orders)
  return orders
}

function addActivity(order: Order, message: string): Order {
  const entry: OrderActivity = {
    id: generateId('act'),
    message,
    created_at: new Date().toISOString(),
  }
  return {
    ...order,
    activity_log: [entry, ...(order.activity_log ?? [])],
    updated_at: new Date().toISOString(),
  }
}

function applyFilters(orders: Order[], filters?: OrderFilters): Order[] {
  let result = [...orders]
  if (!filters?.include_deleted) {
    result = result.filter((o) => !o.deleted_at)
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase()
    result = result.filter(
      (o) =>
        o.order_id.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.customer_phone.includes(q) ||
        o.product_name.toLowerCase().includes(q) ||
        (o.sku?.toLowerCase().includes(q) ?? false) ||
        (o.tracking_id?.toLowerCase().includes(q) ?? false),
    )
  }
  if (filters?.status && filters.status !== 'all') {
    result = result.filter((o) => o.status === filters.status)
  }
  if (filters?.store && filters.store !== 'all') {
    result = result.filter((o) => o.store_id === filters.store)
  }
  if (filters?.courier && filters.courier !== 'all') {
    result = result.filter((o) => o.courier_id === filters.courier)
  }
  if (filters?.fraud_level && filters.fraud_level !== 'all') {
    result = result.filter((o) => o.fraud_level === filters.fraud_level)
  }
  return result
}

const BOOKABLE_STATUSES: OrderStatus[] = ['Confirmed', 'Packed']

export const ordersService = {
  async getOrders(filters?: OrderFilters) {
    await delay()
    return applyFilters(loadOrders(), filters)
  },

  async getOrderById(id: string) {
    await delay(150)
    return loadOrders().find((o) => o.id === id) ?? null
  },

  async getOrdersByIds(ids: string[]) {
    await delay(150)
    const set = new Set(ids)
    return loadOrders().filter((o) => set.has(o.id) && !o.deleted_at)
  },

  async getOrderStats(): Promise<OrderStats> {
    await delay(150)
    const orders = loadOrders().filter((o) => !o.deleted_at)
    return {
      total: orders.length,
      new: orders.filter((o) => o.status === 'New').length,
      confirmed: orders.filter((o) => o.status === 'Confirmed').length,
      packed: orders.filter((o) => o.status === 'Packed').length,
      courier_booked: orders.filter((o) => o.status === 'Courier Booked').length,
      shipped: orders.filter((o) => o.status === 'Shipped').length,
      delivered: orders.filter((o) => o.status === 'Delivered').length,
      returned: orders.filter((o) => o.status === 'Returned').length,
      cancelled: orders.filter((o) => o.status === 'Cancelled').length,
      high_fraud: orders.filter((o) => o.fraud_level === 'HIGH' || o.fraud_level === 'BLOCKED').length,
    }
  },

  async createOrder(input: CreateOrderInput) {
    await delay(300)
    const store = MOCK_STORES.find((s) => s.id === input.store_id)
    const now = new Date().toISOString()
    let order: Order = {
      id: generateId('o'),
      order_id: generateOrderId(),
      store_id: input.store_id,
      store_name: store?.name ?? 'Unknown Store',
      customer_id: input.customer_id,
      customer_name: input.customer_name,
      customer_phone: input.customer_phone,
      delivery_address: input.delivery_address,
      product_id: input.product_id,
      product_name: input.product_name,
      sku: input.sku,
      quantity: input.quantity,
      unit_price: input.unit_price,
      cod_amount: input.cod_amount,
      courier_id: input.courier_id,
      courier_name: input.courier_name,
      status: 'New',
      fraud_level: input.fraud_level,
      fraud_score: input.fraud_score,
      payment_status: 'pending',
      assigned_to: input.assigned_to ?? 'Admin',
      delivery_area: input.delivery_area,
      customer_note: input.customer_note,
      order_note: input.order_note,
      activity_log: [],
      created_at: now,
      updated_at: now,
    }
    order = addActivity(order, 'Order created')

    const orders = [order, ...loadOrders()]
    saveOrders(orders)
    return order
  },

  async updateOrder(id: string, input: UpdateOrderInput) {
    await delay(250)
    const existing = loadOrders().find((o) => o.id === id)
    if (!existing) throw new Error('Order not found')
    if (existing.status === 'Delivered') {
      throw new Error('Delivered orders cannot be edited')
    }

    let updated: Order | null = null
    const store = input.store_id ? MOCK_STORES.find((s) => s.id === input.store_id) : undefined

    updateStorageItem(STORAGE_KEYS.orders, loadOrders(), (current) =>
      current.map((o) => {
        if (o.id !== id) return o
        updated = migrateOrder({
          ...o,
          ...input,
          store_name: store?.name ?? o.store_name,
          updated_at: new Date().toISOString(),
        })
        return updated
      }),
    )
    if (!updated) throw new Error('Order not found')
    return updated
  },

  async updateStatus(orderId: string, status: OrderStatus) {
    await delay(200)
    let updated: Order | null = null
    updateStorageItem(STORAGE_KEYS.orders, loadOrders(), (current) =>
      current.map((o) => {
        if (o.id !== orderId) return o
        let next = { ...o, status, updated_at: new Date().toISOString() }
        next = addActivity(next, `Status changed to ${status}`)
        if (status === 'Returned') {
          customersService.updateCustomerRiskOnReturn(o.customer_phone).catch(() => {})
        }
        if (status === 'Delivered') {
          next = { ...next, payment_status: 'collected' }
        }
        updated = next
        return next
      }),
    )
    if (!updated) throw new Error('Order not found')
    return updated
  },

  async bulkUpdateStatus(orderIds: string[], status: OrderStatus) {
    await delay(300)
    const idSet = new Set(orderIds)
    updateStorageItem(STORAGE_KEYS.orders, loadOrders(), (current) =>
      current.map((o) => {
        if (!idSet.has(o.id)) return o
        if (o.status === 'Delivered') return o
        let next = { ...o, status, updated_at: new Date().toISOString() }
        next = addActivity(next, `Bulk status update to ${status}`)
        return next
      }),
    )
  },

  async bookCourier(orderId: string, courierId: string, courierName: string) {
    const order = loadOrders().find((o) => o.id === orderId)
    if (!order) throw new Error('Order not found')
    if (order.status === 'Cancelled') throw new Error('Cancelled orders cannot be courier booked')
    if (!BOOKABLE_STATUSES.includes(order.status)) {
      throw new Error('Courier booking allowed only for Confirmed or Packed orders')
    }
    if (order.fraud_level === 'BLOCKED') {
      throw new Error('Blocked fraud risk orders cannot be courier booked')
    }

    const consignment = await courierApiDemoService.createConsignmentDemo(orderId, courierId)
    if (!consignment.success) {
      throw new Error(consignment.message)
    }

    let updated: Order | null = null
    updateStorageItem(STORAGE_KEYS.orders, loadOrders(), (current) =>
      current.map((o) => {
        if (o.id !== orderId) return o
        let next: Order = {
          ...o,
          courier_id: courierId,
          courier_name: consignment.courier || courierName,
          tracking_id: consignment.tracking_id,
          status: 'Courier Booked',
          updated_at: new Date().toISOString(),
        }
        next = addActivity(
          next,
          `Courier booked with ${consignment.courier}. Tracking: ${consignment.tracking_id} (${consignment.consignment_id})`,
        )
        updated = next
        return next
      }),
    )

    updateStorageItem<
      {
        id: string
        order_id: string
        courier_id: string
        tracking_id: string
        status: string
        message: string
        created_at: string
        updated_at: string
      }[]
    >(STORAGE_KEYS.courierStatusLogs, [], (current) => [
      {
        id: generateId('csl'),
        order_id: orderId,
        courier_id: courierId,
        tracking_id: consignment.tracking_id,
        status: consignment.status,
        message: consignment.message,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      ...current,
    ])

    if (!updated) throw new Error('Order not found')
    return updated
  },

  async addNote(orderId: string, note: string, type: 'customer' | 'order') {
    await delay(200)
    let updated: Order | null = null
    updateStorageItem(STORAGE_KEYS.orders, loadOrders(), (current) =>
      current.map((o) => {
        if (o.id !== orderId) return o
        let next: Order = {
          ...o,
          ...(type === 'customer' ? { customer_note: note } : { order_note: note }),
          updated_at: new Date().toISOString(),
        }
        next = addActivity(next, `${type === 'customer' ? 'Customer' : 'Order'} note updated`)
        updated = next
        return next
      }),
    )
    if (!updated) throw new Error('Order not found')
    return updated
  },

  async cancelCourier(orderId: string) {
    await delay(200)
    let updated: Order | null = null
    updateStorageItem(STORAGE_KEYS.orders, loadOrders(), (current) =>
      current.map((o) => {
        if (o.id !== orderId) return o
        const revertStatus =
          o.status === 'Courier Booked' || o.status === 'Shipped' ? 'Packed' : o.status
        let next: Order = {
          ...o,
          courier_id: undefined,
          courier_name: undefined,
          tracking_id: undefined,
          status: revertStatus,
          updated_at: new Date().toISOString(),
        }
        next = addActivity(next, 'Courier booking cancelled')
        updated = next
        return next
      }),
    )
    if (!updated) throw new Error('Order not found')
    return updated
  },

  async bulkBookCourier(orderIds: string[], courierId: string, courierName: string) {
    const results: Order[] = []
    for (const orderId of orderIds) {
      try {
        const updated = await this.bookCourier(orderId, courierId, courierName)
        results.push(updated)
      } catch {
        // skip orders that fail validation or API demo
      }
    }
    return results
  },

  async softDelete(orderId: string) {
    await delay(200)
    const now = new Date().toISOString()
    updateStorageItem(STORAGE_KEYS.orders, loadOrders(), (current) =>
      current.map((o) =>
        o.id === orderId ? addActivity({ ...o, deleted_at: now }, 'Order archived') : o,
      ),
    )
  },

  async restore(orderId: string) {
    await delay(200)
    updateStorageItem(STORAGE_KEYS.orders, loadOrders(), (current) =>
      current.map((o) =>
        o.id === orderId
          ? addActivity({ ...o, deleted_at: null, updated_at: new Date().toISOString() }, 'Order restored')
          : o,
      ),
    )
  },
}
