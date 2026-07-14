import { peekDatabase } from '@/database/transaction'
import { getProductCoverImage } from '@/lib/images/product-image-utils'
import { reportingService } from '@/services/reporting.service'

function isToday(iso: string): boolean {
  return iso.slice(0, 10) === new Date().toISOString().slice(0, 10)
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function dayLabel(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-BD', { weekday: 'short' })
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 1000) / 10
}

export interface DashboardFilters {
  branchId?: string | null
  from?: string
  to?: string
}

export const dashboardService = {
  getOwnerDashboard(branchId?: string | null, filters: DashboardFilters = {}) {
    const db = peekDatabase()
    const branch = filters.branchId ?? branchId

    const sales = db.sales.filter(
      (s) => s.status === 'Completed' && (!branch || s.branchId === branch),
    )
    const todaySales = sales.filter((s) => isToday(s.created_at))
    const yesterday = daysAgo(1)
    const yesterdaySales = sales.filter((s) => s.created_at.slice(0, 10) === yesterday)

    const todayExpenses = db.financialTransactions.filter(
      (t) => t.type === 'Expense' && isToday(t.created_at),
    )
    const yesterdayExpenses = db.financialTransactions.filter(
      (t) => t.type === 'Expense' && t.created_at.slice(0, 10) === yesterday,
    )

    const customerDue = db.customers.reduce((s, c) => s + c.currentDue, 0)
    const supplierDue = db.purchases.reduce((s, p) => s + p.dueAmount, 0)

    const todayCollection = todaySales.reduce((s, x) => s + x.paidAmount, 0)
    const yesterdayCollection = yesterdaySales.reduce((s, x) => s + x.paidAmount, 0)
    const todayExpenseTotal = todayExpenses.reduce((s, x) => s + x.amount, 0)
    const yesterdayExpenseTotal = yesterdayExpenses.reduce((s, x) => s + x.amount, 0)
    const todaySalesTotal = todaySales.reduce((s, x) => s + x.total, 0)
    const yesterdaySalesTotal = yesterdaySales.reduce((s, x) => s + x.total, 0)
    const netCashFlow = todayCollection - todayExpenseTotal
    const yesterdayNet = yesterdayCollection - yesterdayExpenseTotal

    // Last 7 days sales vs collection
    const salesOverview = Array.from({ length: 7 }, (_, i) => {
      const date = daysAgo(6 - i)
      const daySales = sales.filter((s) => s.created_at.slice(0, 10) === date)
      return {
        date,
        label: dayLabel(date),
        sales: daySales.reduce((s, x) => s + x.total, 0),
        collection: daySales.reduce((s, x) => s + x.paidAmount, 0),
      }
    })

    // Cash flow trend — current month by day (sample up to 14 points)
    const monthStart = new Date()
    monthStart.setDate(1)
    const cashFlowTrend: { date: string; label: string; income: number; expense: number; profit: number }[] = []
    for (let i = 0; i < 14; i++) {
      const d = new Date(monthStart)
      d.setDate(monthStart.getDate() + i)
      if (d > new Date()) break
      const date = d.toISOString().slice(0, 10)
      const income = sales
        .filter((s) => s.created_at.slice(0, 10) === date)
        .reduce((s, x) => s + x.paidAmount, 0)
      const expense = db.financialTransactions
        .filter((t) => t.type === 'Expense' && t.created_at.slice(0, 10) === date)
        .reduce((s, x) => s + x.amount, 0)
      cashFlowTrend.push({
        date,
        label: String(d.getDate()),
        income,
        expense,
        profit: income - expense,
      })
    }

    const channelPerformance = (
      ['Physical Shop', 'Website', 'Facebook', 'WhatsApp', 'Phone Order', 'Marketplace'] as const
    ).map((channel) => {
      const rows = sales.filter((s) => s.channel === channel)
      return {
        channel,
        sales: rows.reduce((s, x) => s + x.total, 0),
        count: rows.length,
      }
    })

    const channelTotal = channelPerformance.reduce((s, c) => s + c.sales, 0)

    const branchPerformance = db.branches
      .filter((b) => !b.code.includes('WH') && b.isActive)
      .map((b) => {
        const bs = db.sales.filter((s) => s.branchId === b.id && s.status === 'Completed')
        const salesTotal = bs.reduce((s, x) => s + x.total, 0)
        const collection = bs.reduce((s, x) => s + x.paidAmount, 0)
        const cogs = bs.flatMap((s) => s.items).reduce((s, i) => s + i.cost * i.quantity, 0)
        return {
          id: b.id,
          name: b.name,
          sales: salesTotal,
          collection,
          profit: salesTotal - cogs,
          orders: bs.length,
        }
      })
      .sort((a, b) => b.sales - a.sales)

    const topProducts = reportingService
      .productPerformance()
      .slice(0, 5)
      .map((p, index) => {
        const product = db.products.find((x) => x.id === p.productId)
        return {
          rank: index + 1,
          productId: p.productId,
          name: p.name,
          qty: p.qty,
          revenue: p.revenue,
          image: getProductCoverImage(product),
        }
      })

    // Deduplicate low stock by product ID
    const lowStockMap = new Map<
      string,
      { productId: string; productName: string; branchName: string; qty: number; image: string }
    >()
    for (const b of db.stockBalances) {
      if (branch && b.branchId !== branch) continue
      const available = b.quantity - b.reserved
      if (available > db.settings.lowStockThreshold) continue
      const product = db.products.find((p) => p.id === b.productId)
      if (!product) continue
      const existing = lowStockMap.get(b.productId)
      if (!existing || available < existing.qty) {
        const br = db.branches.find((x) => x.id === b.branchId)
        lowStockMap.set(b.productId, {
          productId: b.productId,
          productName: product.name,
          branchName: br?.name ?? '',
          qty: available,
          image: getProductCoverImage(product),
        })
      }
    }
    const lowStockProducts = [...lowStockMap.values()]
      .sort((a, b) => a.qty - b.qty)
      .slice(0, 6)

    const orderStatuses = {
      pending: db.orders.filter((o) => ['New', 'Confirmed', 'Pending'].includes(o.status)).length,
      readyToShip: db.orders.filter((o) => ['Packed', 'Courier Ready'].includes(o.status)).length,
      courierBooked: db.orders.filter((o) => o.status === 'Courier Booked').length,
      inTransit: db.orders.filter((o) => ['Picked Up', 'In Transit', 'Shipped'].includes(o.status)).length,
      deliveredToday: db.orders.filter((o) => o.status === 'Delivered' && isToday(o.updated_at)).length,
      returnedToday: db.orders.filter((o) => o.status === 'Returned' && isToday(o.updated_at)).length,
    }

    const today = new Date().toISOString().slice(0, 10)
    const attendanceRows = db.attendance.filter((a) => a.date === today)
    const attendanceEmployees = attendanceRows.slice(0, 5).map((row) => {
      const emp = db.employees.find((e) => e.id === row.employeeId)
      return {
        id: row.id,
        name: emp?.name ?? 'Employee',
        role: emp?.designation ?? emp?.department ?? '',
        status: row.status,
        checkIn: row.checkIn ?? '',
      }
    })

    const primaryAccounts = db.financialAccounts
      .filter((a) =>
        /cash|bank|bkash|nagad/i.test(a.name) ||
        ['Cash', 'Bank', 'Mobile Banking'].includes(a.type),
      )
      .slice(0, 4)

    return {
      kpis: {
        todaySales: todaySalesTotal,
        todayCollection,
        todayExpenses: todayExpenseTotal,
        netCashFlow,
        customerDue,
        supplierDue,
        pendingCourier: orderStatuses.courierBooked + orderStatuses.inTransit,
        lowStock: lowStockProducts.length,
        trends: {
          sales: pctChange(todaySalesTotal, yesterdaySalesTotal),
          collection: pctChange(todayCollection, yesterdayCollection),
          expenses: pctChange(todayExpenseTotal, yesterdayExpenseTotal),
          netCashFlow: pctChange(netCashFlow, yesterdayNet),
        },
      },
      salesOverview,
      cashFlowTrend,
      channelPerformance,
      channelTotal,
      branchPerformance,
      topProducts,
      orderStatuses,
      accounts: primaryAccounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        balance: a.balance,
      })),
      recentActivity: db.activities.slice(0, 5),
      notifications: db.notifications.slice(0, 8),
      lowStockProducts,
      attendanceToday: {
        present: attendanceRows.filter((r) =>
          ['Present', 'Late', 'Overtime', 'Early Leave'].includes(r.status),
        ).length,
        late: attendanceRows.filter((r) => r.status === 'Late').length,
        absent: attendanceRows.filter((r) => r.status === 'Absent').length,
        leave: attendanceRows.filter((r) => r.status === 'Leave').length,
        employees: attendanceEmployees,
      },
    }
  },
}
