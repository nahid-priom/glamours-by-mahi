import { peekDatabase } from '@/database/transaction'

export interface SalesReportFilters {
  from?: string
  to?: string
  branchId?: string
  channel?: string
  salespersonId?: string
  paymentMethod?: string
}

export const reportingService = {
  salesSummary(filters: SalesReportFilters = {}) {
    const db = peekDatabase()
    const sales = db.sales.filter((s) => {
      if (s.deleted_at) return false
      if (s.status === 'Cancelled') return false
      if (filters.branchId && s.branchId !== filters.branchId) return false
      if (filters.channel && s.channel !== filters.channel) return false
      if (filters.salespersonId && s.salespersonId !== filters.salespersonId) return false
      if (filters.paymentMethod && s.paymentMethod !== filters.paymentMethod) return false
      if (filters.from && s.created_at.slice(0, 10) < filters.from) return false
      if (filters.to && s.created_at.slice(0, 10) > filters.to) return false
      return true
    })
    const returns = db.saleReturns.filter((r) => {
      const sale = db.sales.find((s) => s.id === r.saleId)
      if (!sale) return false
      if (filters.branchId && sale.branchId !== filters.branchId) return false
      if (filters.from && r.created_at.slice(0, 10) < filters.from) return false
      if (filters.to && r.created_at.slice(0, 10) > filters.to) return false
      return true
    })
    const gross = sales.reduce((s, x) => s + x.total, 0)
    const discount = sales.reduce((s, x) => s + x.discount, 0)
    const returnsTotal = returns.reduce((s, x) => s + x.total, 0)
    const cogs = sales.flatMap((s) => s.items).reduce((s, i) => s + i.cost * i.quantity, 0)
    const paid = sales.reduce((s, x) => s + x.paidAmount, 0)
    const due = sales.reduce((s, x) => s + x.dueAmount, 0)
    const net = gross - returnsTotal
    const profit = net - cogs
    return {
      grossSales: gross,
      netSales: net,
      discount,
      returns: returnsTotal,
      cogs,
      grossProfit: profit,
      profitMargin: net ? Math.round((profit / net) * 1000) / 10 : 0,
      paidAmount: paid,
      dueAmount: due,
      orders: sales.length,
      averageOrderValue: sales.length ? Math.round(gross / sales.length) : 0,
    }
  },

  productPerformance() {
    const db = peekDatabase()
    const map = new Map<
      string,
      { productId: string; name: string; qty: number; revenue: number; cost: number; returns: number }
    >()
    for (const sale of db.sales.filter((s) => !s.deleted_at && s.status === 'Completed')) {
      for (const item of sale.items) {
        const row = map.get(item.productId) ?? {
          productId: item.productId,
          name: item.name,
          qty: 0,
          revenue: 0,
          cost: 0,
          returns: 0,
        }
        row.qty += item.quantity
        row.revenue += item.total
        row.cost += item.cost * item.quantity
        map.set(item.productId, row)
      }
    }
    return [...map.values()]
      .map((r) => ({ ...r, profit: r.revenue - r.cost }))
      .sort((a, b) => b.revenue - a.revenue)
  },

  branchPerformance() {
    const db = peekDatabase()
    return db.branches.map((b) => {
      const sales = db.sales.filter((s) => s.branchId === b.id && !s.deleted_at && s.status === 'Completed')
      const total = sales.reduce((s, x) => s + x.total, 0)
      const cogs = sales.flatMap((s) => s.items).reduce((s, i) => s + i.cost * i.quantity, 0)
      return {
        branchId: b.id,
        name: b.name,
        sales: total,
        orders: sales.length,
        profit: total - cogs,
      }
    })
  },

  channelPerformance() {
    const db = peekDatabase()
    const channels = new Map<string, { channel: string; sales: number; orders: number }>()
    for (const sale of db.sales.filter((s) => !s.deleted_at && s.status === 'Completed')) {
      const row = channels.get(sale.channel) ?? { channel: sale.channel, sales: 0, orders: 0 }
      row.sales += sale.total
      row.orders += 1
      channels.set(sale.channel, row)
    }
    return [...channels.values()].sort((a, b) => b.sales - a.sales)
  },
}
