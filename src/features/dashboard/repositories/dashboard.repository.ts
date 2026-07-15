import { supabase } from '@/lib/supabase/client'
import { lowStock } from '@/features/inventory/repositories/inventory.repository'

export type DashboardBranch = { id: string; name: string; code: string }

export type DashboardOverview = {
  kpis: {
    todaySales: number
    todayCollection: number
    todayExpenses: number
    netCashFlow: number
    customerDue: number
    supplierDue: number
    lowStockCount: number
    trends: {
      sales: number
      collection: number
      expenses: number
      netCashFlow: number
    }
  }
  salesOverview: Array<{ date: string; label: string; sales: number; collection: number }>
  channelPerformance: Array<{ channel: string; sales: number; count: number }>
  channelTotal: number
  orderStatuses: {
    pending: number
    readyToShip: number
    courierBooked: number
    inTransit: number
    deliveredToday: number
    returnedToday: number
  }
  topProducts: Array<{
    rank: number
    productId: string
    name: string
    qty: number
    revenue: number
    image: string
  }>
  branchPerformance: Array<{
    id: string
    name: string
    sales: number
    collection: number
    profit: number
  }>
  lowStockProducts: Array<{
    productId: string
    productName: string
    branchName: string
    qty: number
    image: string
  }>
  cashFlowTrend: Array<{
    date: string
    label: string
    income: number
    expense: number
    profit: number
  }>
  attendanceToday: {
    present: number
    late: number
    absent: number
    leave: number
    employees: Array<{
      id: string
      name: string
      role: string
      status: string
      checkIn: string
    }>
  }
  recentActivity: Array<{
    id: string
    action: string
    userName: string
    details: string
    created_at: string
  }>
  accounts: Array<{ id: string; name: string; balance: number }>
}

function dayStartIso(d = new Date()) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.toISOString()
}

function dayEndIso(d = new Date()) {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x.toISOString()
}

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function dayLabel(isoDate: string) {
  return new Date(isoDate + 'T12:00:00').toLocaleDateString('en-BD', { weekday: 'short' })
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 1000) / 10
}

async function sumDue(table: 'customers' | 'suppliers') {
  const { data, error } = await supabase.from(table).select('current_due').is('deleted_at', null)
  if (error) throw error
  return (data ?? []).reduce((s, r) => s + Number(r.current_due ?? 0), 0)
}

async function salesTotals(fromIso: string, toIso: string, branchId?: string | null) {
  let builder = supabase
    .from('sales')
    .select('grand_total, paid_total')
    .eq('status', 'completed')
    .is('deleted_at', null)
    .gte('created_at', fromIso)
    .lte('created_at', toIso)
  if (branchId) builder = builder.eq('branch_id', branchId)
  const { data, error } = await builder
  if (error) throw error
  const rows = data ?? []
  return {
    sales: rows.reduce((s, r) => s + Number(r.grand_total ?? 0), 0),
    collection: rows.reduce((s, r) => s + Number(r.paid_total ?? 0), 0),
  }
}

async function expenseTotal(fromDate: string, toDate: string) {
  // Prefer simple retail expense entries; fall back to 0 if table unavailable
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data, error } = await db
    .from('expense_entries')
    .select('amount')
    .eq('status', 'posted')
    .is('deleted_at', null)
    .gte('entry_date', fromDate)
    .lte('entry_date', toDate)
  if (error) {
    console.warn('dashboard expenses query failed', error.message)
    return 0
  }
  return (data ?? []).reduce((s: number, r: { amount: number }) => s + Number(r.amount ?? 0), 0)
}

export async function listDashboardBranches(): Promise<DashboardBranch[]> {
  const { data, error } = await supabase
    .from('branches')
    .select('id, name, code')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name')
  if (error) throw error
  return (data ?? []).filter((b) => !b.code.includes('WH'))
}

export async function getDashboardOverview(branchId?: string | null): Promise<DashboardOverview> {
  const todayStart = dayStartIso()
  const todayEnd = dayEndIso()
  const yesterdayStart = dayStartIso(daysAgo(1))
  const yesterdayEnd = dayEndIso(daysAgo(1))
  const todayDate = todayStart.slice(0, 10)
  const yesterdayDate = yesterdayStart.slice(0, 10)

  const [
    today,
    yesterday,
    customerDue,
    supplierDue,
    todayExpenses,
    yesterdayExpenses,
    recentSalesRes,
    accountsRes,
    lowStockRes,
  ] = await Promise.all([
    salesTotals(todayStart, todayEnd, branchId),
    salesTotals(yesterdayStart, yesterdayEnd, branchId),
    sumDue('customers'),
    sumDue('suppliers'),
    expenseTotal(todayDate, todayDate),
    expenseTotal(yesterdayDate, yesterdayDate),
    (async () => {
      let q = supabase
        .from('sales')
        .select('id, invoice_no, grand_total, paid_total, created_at, customers(name)')
        .eq('status', 'completed')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(8)
      if (branchId) q = q.eq('branch_id', branchId)
      return q
    })(),
    supabase
      .from('financial_accounts')
      .select('id, name, current_balance')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name')
      .limit(8),
    lowStock({ branchId: branchId ?? undefined, page: 1, pageSize: 5 }).catch(() => ({
      items: [] as Awaited<ReturnType<typeof lowStock>>['items'],
      total: 0,
    })),
  ])

  if (recentSalesRes.error) throw recentSalesRes.error
  if (accountsRes.error) throw accountsRes.error

  const recentSales = recentSalesRes.data ?? []
  const netCashFlow = today.collection - todayExpenses
  const yesterdayNet = yesterday.collection - yesterdayExpenses

  const salesOverview = await Promise.all(
    Array.from({ length: 7 }, async (_, i) => {
      const d = daysAgo(6 - i)
      const date = d.toISOString().slice(0, 10)
      const totals = await salesTotals(dayStartIso(d), dayEndIso(d), branchId)
      return {
        date,
        label: dayLabel(date),
        sales: totals.sales,
        collection: totals.collection,
      }
    }),
  )

  return {
    kpis: {
      todaySales: today.sales,
      todayCollection: today.collection,
      todayExpenses,
      netCashFlow,
      customerDue,
      supplierDue,
      lowStockCount: lowStockRes.total,
      trends: {
        sales: pctChange(today.sales, yesterday.sales),
        collection: pctChange(today.collection, yesterday.collection),
        expenses: pctChange(todayExpenses, yesterdayExpenses),
        netCashFlow: pctChange(netCashFlow, yesterdayNet),
      },
    },
    salesOverview,
    channelPerformance: [],
    channelTotal: today.sales,
    orderStatuses: {
      pending: 0,
      readyToShip: 0,
      courierBooked: 0,
      inTransit: 0,
      deliveredToday: 0,
      returnedToday: 0,
    },
    topProducts: [],
    branchPerformance: [],
    lowStockProducts: lowStockRes.items.slice(0, 5).map((r) => ({
      productId: r.productId,
      productName: r.productName,
      branchName: r.branchName || r.locationName,
      qty: r.quantity,
      image: '',
    })),
    cashFlowTrend: salesOverview.map((d) => ({
      date: d.date,
      label: d.label,
      income: d.collection,
      expense: 0,
      profit: d.collection,
    })),
    attendanceToday: { present: 0, late: 0, absent: 0, leave: 0, employees: [] },
    recentActivity: recentSales.map((s) => {
      const cust = s.customers as unknown as { name: string } | null
      return {
        id: s.id,
        action: 'Sale completed',
        userName: cust?.name ?? 'Walk-in',
        details: `${s.invoice_no} · ৳${Number(s.grand_total).toFixed(0)}`,
        created_at: s.created_at,
      }
    }),
    accounts: (accountsRes.data ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      balance: Number(a.current_balance ?? 0),
    })),
  }
}

export const dashboardRepository = {
  listDashboardBranches,
  getDashboardOverview,
}
