import type { Invoice, InvoiceFilters, InvoiceStats, UpdateInvoiceInput } from './invoices.types'
import { ordersService } from '@/features/storefront/legacy-oms/orders.service'
import { MOCK_STORES } from '@/lib/mock-data'
import { auditCreate, auditUpdate, delay } from '@/lib/service-utils'
import { getStorageItem, setStorageItem, STORAGE_KEYS, updateStorageItem } from '@/lib/storage'

function generateInvoiceNo(storeId: string): string {
  const store = MOCK_STORES.find((s) => s.id === storeId)
  const prefix = store?.invoice_prefix ?? 'INV'
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const seq = String(Math.floor(Math.random() * 9000) + 1000)
  return `${prefix}-${date}-${seq}`
}

function seedInvoices(): Invoice[] {
  const now = new Date().toISOString()
  return [
    auditCreate(
      {
        invoice_no: 'FB-20240708-1001',
        order_id: 'o1',
        order_number: 'REX-20240708-001',
        customer_id: 'cu1',
        customer_name: 'Rahim Uddin',
        store_id: 's1',
        store_name: 'Main Facebook Store',
        invoice_date: now,
        amount: 2500,
        status: 'paid',
        print_count: 2,
        last_printed_at: now,
      },
      'inv',
    ) as Invoice,
    auditCreate(
      {
        invoice_no: 'SH-20240708-1002',
        order_id: 'o8',
        order_number: 'REX-20240708-008',
        customer_id: 'cu2',
        customer_name: 'Karim Ahmed',
        store_id: 's2',
        store_name: 'Shopify Store',
        invoice_date: now,
        amount: 1050,
        status: 'issued',
        print_count: 1,
        last_printed_at: now,
      },
      'inv',
    ) as Invoice,
  ]
}

function loadInvoices(): Invoice[] {
  const stored = getStorageItem<Invoice[]>(STORAGE_KEYS.invoices, [])
  if (stored.length === 0) {
    const seeded = seedInvoices()
    setStorageItem(STORAGE_KEYS.invoices, seeded)
    return seeded
  }
  return stored
}

function applyFilters(invoices: Invoice[], filters?: InvoiceFilters): Invoice[] {
  let result = [...invoices]
  if (!filters?.include_deleted) {
    result = result.filter((i) => !i.deleted_at)
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase()
    result = result.filter(
      (i) =>
        i.invoice_no.toLowerCase().includes(q) ||
        i.order_number.toLowerCase().includes(q) ||
        i.customer_name.toLowerCase().includes(q),
    )
  }
  if (filters?.status && filters.status !== 'all') {
    result = result.filter((i) => i.status === filters.status)
  }
  if (filters?.store && filters.store !== 'all') {
    result = result.filter((i) => i.store_id === filters.store)
  }
  if (filters?.date_from) {
    const from = new Date(filters.date_from).getTime()
    result = result.filter((i) => new Date(i.invoice_date).getTime() >= from)
  }
  if (filters?.date_to) {
    const end = new Date(filters.date_to)
    end.setHours(23, 59, 59, 999)
    result = result.filter((i) => new Date(i.invoice_date).getTime() <= end.getTime())
  }
  return result.sort(
    (a, b) => new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime(),
  )
}

export const invoicesService = {
  async getInvoices(filters?: InvoiceFilters) {
    await delay()
    return applyFilters(loadInvoices(), filters)
  },

  async getInvoiceById(id: string) {
    await delay(150)
    return loadInvoices().find((i) => i.id === id) ?? null
  },

  async getInvoiceByOrderId(orderId: string) {
    await delay(150)
    return loadInvoices().find((i) => i.order_id === orderId && !i.deleted_at) ?? null
  },

  async getStats(): Promise<InvoiceStats> {
    await delay(150)
    const invoices = loadInvoices().filter((i) => !i.deleted_at)
    return {
      total: invoices.length,
      issued: invoices.filter((i) => i.status === 'issued').length,
      paid: invoices.filter((i) => i.status === 'paid').length,
      void: invoices.filter((i) => i.status === 'void').length,
      total_amount: invoices
        .filter((i) => i.status !== 'void')
        .reduce((sum, i) => sum + i.amount, 0),
    }
  },

  async generateFromOrder(orderId: string) {
    await delay(300)
    const order = await ordersService.getOrderById(orderId)
    if (!order) throw new Error('Order not found')
    if (order.deleted_at) throw new Error('Cannot invoice archived order')

    const existing = loadInvoices().find(
      (i) => i.order_id === orderId && !i.deleted_at && i.status !== 'void',
    )
    if (existing) throw new Error('Invoice already exists for this order')

    const invoice = auditCreate(
      {
        invoice_no: generateInvoiceNo(order.store_id),
        order_id: order.id,
        order_number: order.order_id,
        customer_id: order.customer_id,
        customer_name: order.customer_name,
        store_id: order.store_id,
        store_name: order.store_name,
        invoice_date: new Date().toISOString(),
        amount: order.cod_amount,
        status: 'issued',
        print_count: 0,
        last_printed_at: null,
      },
      'inv',
    ) as Invoice

    updateStorageItem(STORAGE_KEYS.invoices, loadInvoices(), (current) => [invoice, ...current])
    return invoice
  },

  async markPaid(id: string) {
    await delay(200)
    let updated: Invoice | null = null
    updateStorageItem(STORAGE_KEYS.invoices, loadInvoices(), (current) =>
      current.map((i) => {
        if (i.id !== id) return i
        if (i.status === 'void') throw new Error('Cannot mark void invoice as paid')
        updated = auditUpdate(i, { status: 'paid' })
        return updated
      }),
    )
    if (!updated) throw new Error('Invoice not found')
    return updated
  },

  async void(id: string) {
    await delay(200)
    let updated: Invoice | null = null
    updateStorageItem(STORAGE_KEYS.invoices, loadInvoices(), (current) =>
      current.map((i) => {
        if (i.id !== id) return i
        if (i.status === 'paid') throw new Error('Cannot void a paid invoice')
        updated = auditUpdate(i, { status: 'void' })
        return updated
      }),
    )
    if (!updated) throw new Error('Invoice not found')
    return updated
  },

  async update(id: string, input: UpdateInvoiceInput) {
    await delay(200)
    let updated: Invoice | null = null
    updateStorageItem(STORAGE_KEYS.invoices, loadInvoices(), (current) =>
      current.map((i) => {
        if (i.id !== id) return i
        updated = auditUpdate(i, input)
        return updated
      }),
    )
    if (!updated) throw new Error('Invoice not found')
    return updated
  },

  async recordPrint(id: string) {
    await delay(100)
    let updated: Invoice | null = null
    updateStorageItem(STORAGE_KEYS.invoices, loadInvoices(), (current) =>
      current.map((i) => {
        if (i.id !== id) return i
        const now = new Date().toISOString()
        updated = auditUpdate(i, {
          print_count: i.print_count + 1,
          last_printed_at: now,
        })
        return updated
      }),
    )
    if (!updated) throw new Error('Invoice not found')
    return updated
  },

  async softDelete(id: string) {
    await delay(200)
    const now = new Date().toISOString()
    updateStorageItem(STORAGE_KEYS.invoices, loadInvoices(), (current) =>
      current.map((i) =>
        i.id === id ? { ...i, deleted_at: now, updated_at: now, updated_by: 'Admin' } : i,
      ),
    )
  },

  async restore(id: string) {
    await delay(200)
    updateStorageItem(STORAGE_KEYS.invoices, loadInvoices(), (current) =>
      current.map((i) => {
        if (i.id !== id) return i
        return auditUpdate(i, { deleted_at: null })
      }),
    )
  },
}
