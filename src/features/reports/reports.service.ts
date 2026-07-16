import type { ReportFilters, ReportResult, ReportType } from './reports.types'
import type { Store } from '@/types'
import { formatBDT } from '@/lib/format'
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '@/lib/storage'
import { MOCK_STORES } from '@/lib/mock-data'
import { ordersService } from '@/features/storefront/legacy-oms/orders.service'
import { listProducts } from '@/features/products/repositories/catalog.repository'
import { customersService } from '@/features/customers/customers.service'
import { invoicesService } from '@/features/invoices/invoices.service'
import {
  formatReportDate,
  fraudRecommendation,
  paymentStatusLabel,
  reportCell,
  shortAddress,
} from './report-cell.utils'

const delay = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms))

function inDateRange(dateStr: string, from?: string, to?: string): boolean {
  const d = new Date(dateStr).getTime()
  if (from && d < new Date(from).getTime()) return false
  if (to) {
    const end = new Date(to)
    end.setHours(23, 59, 59, 999)
    if (d > end.getTime()) return false
  }
  return true
}

async function filterOrders(filters: ReportFilters) {
  const orders = await ordersService.getOrders({
    store: filters.store,
    courier: filters.courier,
    status: filters.status,
    fraud_level: filters.fraud_level,
  })
  return orders.filter((o) => inDateRange(o.created_at, filters.date_from, filters.date_to))
}

function topProductForStore(
  orders: Awaited<ReturnType<typeof filterOrders>>,
  storeId: string,
): string {
  const counts = new Map<string, number>()
  for (const o of orders) {
    if (o.store_id !== storeId) continue
    counts.set(o.product_name, (counts.get(o.product_name) ?? 0) + 1)
  }
  let top = '—'
  let max = 0
  for (const [name, count] of counts) {
    if (count > max) {
      max = count
      top = name
    }
  }
  return max > 0 ? `${top} (${max})` : '—'
}

function courierStatusLabel(delivered: number, pending: number, total: number): string {
  if (total === 0) return 'Inactive'
  const rate = delivered / total
  if (pending > 0 && rate >= 0.7) return 'Active'
  if (pending > 0) return 'In Progress'
  if (rate >= 0.85) return 'Excellent'
  if (rate >= 0.6) return 'Good'
  return 'Needs Review'
}

function collectionStatusLabel(collected: number, pending: number, total: number): string {
  if (total === 0) return '—'
  if (pending === 0 && collected > 0) return 'Settled'
  if (collected > 0 && pending > 0) return 'Partial'
  if (pending > 0) return 'Pending'
  return 'Review'
}

function stockStatusLabel(stock: number, status: string): string {
  if (status === 'out_of_stock' || stock === 0) return 'Out of Stock'
  if (stock <= 10) return 'Low Stock'
  return 'In Stock'
}

export const reportsService = {
  getSavedFilters(): ReportFilters {
    return getStorageItem<ReportFilters>(STORAGE_KEYS.reportsFilters, {})
  },

  saveFilters(filters: ReportFilters) {
    setStorageItem(STORAGE_KEYS.reportsFilters, filters)
  },

  async generateReport(type: ReportType, filters: ReportFilters): Promise<ReportResult> {
    await delay(300)
    this.saveFilters(filters)

    switch (type) {
      case 'orders':
        return this.buildOrderReport(filters)
      case 'courier':
        return this.buildCourierReport(filters)
      case 'store':
        return this.buildStoreReport(filters)
      case 'collection':
        return this.buildCollectionReport(filters)
      case 'fraud':
        return this.buildFraudReport(filters)
      case 'product_stock':
        return this.buildProductStockReport()
      case 'invoice':
        return this.buildInvoiceReport(filters)
      default:
        throw new Error('Unknown report type')
    }
  },

  async buildOrderReport(filters: ReportFilters): Promise<ReportResult> {
    const orders = await filterOrders(filters)
    const byStatus = (status: string) => orders.filter((o) => o.status === status).length
    const totalCod = orders.reduce((s, o) => s + o.cod_amount, 0)

    const columns = [
      { key: 'order', label: 'Order' },
      { key: 'customer', label: 'Customer' },
      { key: 'product', label: 'Product' },
      { key: 'payment', label: 'Payment' },
      { key: 'delivery', label: 'Delivery' },
      { key: 'risk', label: 'Risk' },
    ]

    const rows = orders.map((o) => {
      const address = o.delivery_address || o.customer_address
      const riskLevel = o.fraud_level

      return {
        order: reportCell(o.order_id, formatReportDate(o.created_at), o.store_name),
        customer: reportCell(
          o.customer_name,
          o.customer_phone,
          undefined,
          undefined,
          address ? shortAddress(address) : undefined,
        ),
        product: reportCell(
          o.product_name,
          `Qty: ${o.quantity}`,
          o.sku ? `SKU: ${o.sku}` : undefined,
        ),
        payment: reportCell(formatBDT(o.cod_amount), paymentStatusLabel(o.payment_status)),
        delivery: reportCell(
          o.courier_name ?? 'Unassigned',
          o.tracking_id ?? undefined,
          o.status,
        ),
        risk: reportCell(fraudRecommendation(riskLevel), undefined, undefined, riskLevel),
      }
    })

    return {
      type: 'orders',
      title: 'Order Report',
      summary: [
        { label: 'Total Orders', value: orders.length },
        { label: 'New', value: byStatus('New') },
        { label: 'Delivered', value: byStatus('Delivered') },
        { label: 'Returned', value: byStatus('Returned') },
        { label: 'Cancelled', value: byStatus('Cancelled') },
        { label: 'Total COD', value: formatBDT(totalCod) },
      ],
      columns,
      rows,
    }
  },

  async buildCourierReport(filters: ReportFilters): Promise<ReportResult> {
    const orders = await filterOrders(filters)
    const grouped = new Map<
      string,
      { name: string; total: number; delivered: number; returned: number; pending: number; cod: number }
    >()

    for (const o of orders) {
      const key = o.courier_id ?? 'unassigned'
      const name = o.courier_name ?? 'Unassigned'
      const entry = grouped.get(key) ?? { name, total: 0, delivered: 0, returned: 0, pending: 0, cod: 0 }
      entry.total++
      if (o.status === 'Delivered') entry.delivered++
      if (o.status === 'Returned') entry.returned++
      if (['New', 'Confirmed', 'Packed', 'Courier Booked', 'Shipped'].includes(o.status)) entry.pending++
      entry.cod += o.cod_amount
      grouped.set(key, entry)
    }

    const columns = [
      { key: 'courier', label: 'Courier' },
      { key: 'performance', label: 'Performance' },
      { key: 'collection', label: 'Collection' },
      { key: 'returns', label: 'Returns' },
      { key: 'status', label: 'Status' },
    ]

    const rows = Array.from(grouped.values()).map((g) => {
      const successRate = g.total > 0 ? `${Math.round((g.delivered / g.total) * 100)}%` : '0%'
      return {
        courier: reportCell(g.name, `${g.total} orders`),
        performance: reportCell(
          `${g.delivered} delivered`,
          `${successRate} success`,
          `${g.pending} pending`,
        ),
        collection: reportCell(formatBDT(g.cod), 'Total COD'),
        returns: reportCell(String(g.returned), 'Returned orders'),
        status: reportCell(
          courierStatusLabel(g.delivered, g.pending, g.total),
          g.pending > 0 ? `${g.pending} in transit` : 'All processed',
        ),
      }
    })

    return {
      type: 'courier',
      title: 'Courier Report',
      summary: [
        { label: 'Couriers', value: grouped.size },
        { label: 'Total Parcels', value: orders.length },
        { label: 'Delivered', value: orders.filter((o) => o.status === 'Delivered').length },
        { label: 'Returned', value: orders.filter((o) => o.status === 'Returned').length },
        { label: 'Pending', value: orders.filter((o) => ['New', 'Confirmed', 'Packed', 'Courier Booked', 'Shipped'].includes(o.status)).length },
        { label: 'Collection', value: formatBDT(orders.reduce((s, o) => s + o.cod_amount, 0)) },
      ],
      columns,
      rows,
    }
  },

  async buildStoreReport(filters: ReportFilters): Promise<ReportResult> {
    const orders = await filterOrders(filters)
    const grouped = new Map<string, { name: string; total: number; cod: number }>()

    for (const o of orders) {
      const entry = grouped.get(o.store_id) ?? { name: o.store_name, total: 0, cod: 0 }
      entry.total++
      entry.cod += o.cod_amount
      grouped.set(o.store_id, entry)
    }

    const columns = [
      { key: 'store', label: 'Store' },
      { key: 'orders', label: 'Orders' },
      { key: 'collection', label: 'Collection' },
      { key: 'top_products', label: 'Top Products' },
      { key: 'status', label: 'Status' },
    ]

    const rows = Array.from(grouped.entries()).map(([storeId, g]) => ({
      store: reportCell(g.name, `${g.total} orders`),
      orders: reportCell(String(g.total), `Avg ${formatBDT(g.total > 0 ? Math.round(g.cod / g.total) : 0)}`),
      collection: reportCell(formatBDT(g.cod), 'Total COD'),
      top_products: reportCell(topProductForStore(orders, storeId)),
      status: reportCell(g.total >= 10 ? 'Active' : 'Moderate', g.total > 0 ? 'Processing orders' : 'Idle'),
    }))

    return {
      type: 'store',
      title: 'Store Report',
      summary: [
        { label: 'Stores', value: grouped.size },
        { label: 'Total Orders', value: orders.length },
        { label: 'Total Collection', value: formatBDT(orders.reduce((s, o) => s + o.cod_amount, 0)) },
      ],
      columns,
      rows,
    }
  },

  async buildCollectionReport(filters: ReportFilters): Promise<ReportResult> {
    const orders = await filterOrders(filters)
    const grouped = new Map<
      string,
      { name: string; total: number; cod: number; collected: number; pending: number; refunded: number }
    >()

    for (const o of orders) {
      const entry = grouped.get(o.store_id) ?? {
        name: o.store_name,
        total: 0,
        cod: 0,
        collected: 0,
        pending: 0,
        refunded: 0,
      }
      entry.total++
      entry.cod += o.cod_amount
      if (o.payment_status === 'collected') entry.collected += o.cod_amount
      else if (o.payment_status === 'refunded') entry.refunded += o.cod_amount
      else entry.pending += o.cod_amount
      grouped.set(o.store_id, entry)
    }

    const columns = [
      { key: 'store', label: 'Store' },
      { key: 'orders', label: 'Orders' },
      { key: 'collection', label: 'Collection' },
      { key: 'payment_summary', label: 'Payment Summary' },
      { key: 'status', label: 'Status' },
    ]

    const rows = Array.from(grouped.values()).map((g) => ({
      store: reportCell(g.name),
      orders: reportCell(String(g.total), 'Total orders'),
      collection: reportCell(formatBDT(g.cod), 'Total COD'),
      payment_summary: reportCell(
        `${formatBDT(g.collected)} collected`,
        `${formatBDT(g.pending)} pending`,
        g.refunded > 0 ? `${formatBDT(g.refunded)} refunded` : undefined,
      ),
      status: reportCell(collectionStatusLabel(g.collected, g.pending, g.cod)),
    }))

    const collected = orders.filter((o) => o.payment_status === 'collected')
    const pending = orders.filter((o) => o.payment_status === 'pending')
    const refunded = orders.filter((o) => o.payment_status === 'refunded')

    return {
      type: 'collection',
      title: 'Collection Report',
      summary: [
        { label: 'Total COD', value: formatBDT(orders.reduce((s, o) => s + o.cod_amount, 0)) },
        { label: 'Collected', value: formatBDT(collected.reduce((s, o) => s + o.cod_amount, 0)), color: 'text-success' },
        { label: 'Pending', value: formatBDT(pending.reduce((s, o) => s + o.cod_amount, 0)), color: 'text-warning' },
        { label: 'Refunded', value: formatBDT(refunded.reduce((s, o) => s + o.cod_amount, 0)), color: 'text-danger' },
      ],
      columns,
      rows,
    }
  },

  async buildFraudReport(filters: ReportFilters): Promise<ReportResult> {
    const [orders, customers] = await Promise.all([
      filterOrders(filters),
      customersService.getCustomers(),
    ])

    const flagged = customers.filter((c) => {
      if (c.is_blacklisted) return true
      if (filters.fraud_level && filters.fraud_level !== 'all') {
        return c.fraud_level === filters.fraud_level
      }
      return c.fraud_level !== 'SAFE'
    })

    const columns = [
      { key: 'customer', label: 'Customer' },
      { key: 'order_history', label: 'Order History' },
      { key: 'return_history', label: 'Return History' },
      { key: 'risk', label: 'Risk' },
      { key: 'recommendation', label: 'Recommendation' },
    ]

    const rows = flagged.map((c) => {
      const riskLevel = c.is_blacklisted ? 'BLOCKED' : c.fraud_level
      const recommendation = fraudRecommendation(riskLevel)

      return {
        customer: reportCell(c.name, c.phone),
        order_history: reportCell(`${c.total_orders} orders`, `${c.delivered_orders ?? 0} delivered`),
        return_history: reportCell(
          `${c.returned_orders} returned`,
          `${c.return_rate}% return rate`,
        ),
        risk: reportCell(undefined, undefined, undefined, riskLevel),
        recommendation: reportCell(recommendation),
      }
    })

    return {
      type: 'fraud',
      title: 'Fraud Report',
      summary: [
        { label: 'Flagged Customers', value: flagged.length },
        { label: 'High Risk', value: flagged.filter((c) => c.fraud_level === 'HIGH').length },
        { label: 'Blocked', value: flagged.filter((c) => c.fraud_level === 'BLOCKED' || c.is_blacklisted).length },
        { label: 'Medium Risk', value: flagged.filter((c) => c.fraud_level === 'MEDIUM').length },
        { label: 'Orders in Period', value: orders.length },
        { label: 'High Risk Orders', value: orders.filter((o) => o.fraud_level === 'HIGH' || o.fraud_level === 'BLOCKED').length },
      ],
      columns,
      rows,
    }
  },

  async loadStores(): Promise<Store[]> {
    try {
      const mod = await import('@/features/stores/stores.service')
      return mod.storesService.getStores()
    } catch {
      return getStorageItem<Store[]>(STORAGE_KEYS.stores, MOCK_STORES)
    }
  },

  async buildInvoiceReport(filters: ReportFilters): Promise<ReportResult> {
    const [invoices, customers] = await Promise.all([
      invoicesService.getInvoices({
        store: filters.store,
        date_from: filters.date_from,
        date_to: filters.date_to,
      }),
      customersService.getCustomers(),
    ])

    const customerMap = new Map(customers.map((c) => [c.id, c]))

    const paid = invoices.filter((i) => i.status === 'paid')
    const issued = invoices.filter((i) => i.status === 'issued')
    const voided = invoices.filter((i) => i.status === 'void')

    const columns = [
      { key: 'invoice', label: 'Invoice' },
      { key: 'customer', label: 'Customer' },
      { key: 'order', label: 'Order' },
      { key: 'amount', label: 'Amount' },
      { key: 'status', label: 'Status' },
    ]

    const rows = invoices.map((i) => {
      const customer = i.customer_id ? customerMap.get(i.customer_id) : undefined
      return {
        invoice: reportCell(i.invoice_no, formatReportDate(i.invoice_date), i.store_name),
        customer: reportCell(
          i.customer_name || customer?.name || '—',
          customer?.phone,
        ),
        order: reportCell(i.order_number, i.order_id),
        amount: reportCell(formatBDT(i.amount)),
        status: reportCell(i.status.charAt(0).toUpperCase() + i.status.slice(1)),
      }
    })

    return {
      type: 'invoice',
      title: 'Invoice Report',
      summary: [
        { label: 'Total Invoices', value: invoices.length },
        { label: 'Issued', value: issued.length, color: 'text-blue-600' },
        { label: 'Paid', value: paid.length, color: 'text-success' },
        { label: 'Void', value: voided.length, color: 'text-danger' },
        {
          label: 'Total Amount',
          value: formatBDT(invoices.filter((i) => i.status !== 'void').reduce((s, i) => s + i.amount, 0)),
        },
      ],
      columns,
      rows,
    }
  },

  async buildProductStockReport(): Promise<ReportResult> {
    const { items } = await listProducts({ page: 1, pageSize: 500, activeOnly: true })
    const lowStock = items.filter((p) => (p.totalStock ?? 0) > 0 && (p.totalStock ?? 0) <= 10)
    const outOfStock = items.filter((p) => (p.totalStock ?? 0) <= 0)

    const columns = [
      { key: 'product', label: 'Product' },
      { key: 'category', label: 'Category' },
      { key: 'inventory', label: 'Inventory' },
      { key: 'price', label: 'Price' },
      { key: 'status', label: 'Status' },
    ]

    const rows = items.map((p) => {
      const stock = p.totalStock ?? 0
      const label = stockStatusLabel(stock, stock <= 0 ? 'out_of_stock' : p.is_active ? 'active' : 'inactive')
      return {
        product: reportCell(p.name, p.base_sku ? `SKU: ${p.base_sku}` : undefined),
        category: reportCell(p.categories?.name ?? '—'),
        inventory: reportCell(`${stock} units`, `${p.variantCount ?? 0} variants`),
        price: reportCell(formatBDT(Number(p.selling_price))),
        status: reportCell(label),
      }
    })

    return {
      type: 'product_stock',
      title: 'Product Stock Report',
      summary: [
        { label: 'Total Products', value: items.length },
        { label: 'Low Stock', value: lowStock.length, color: 'text-warning' },
        { label: 'Out of Stock', value: outOfStock.length, color: 'text-danger' },
        { label: 'Total Units', value: items.reduce((s, p) => s + (p.totalStock ?? 0), 0) },
      ],
      columns,
      rows,
    }
  },
}
