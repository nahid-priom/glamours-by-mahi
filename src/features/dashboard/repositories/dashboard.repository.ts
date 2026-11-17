import { supabase } from '@/lib/supabase/client'
import { lowStock } from '@/features/inventory/repositories/inventory.repository'
import { getInventoryValuationSummary } from '@/features/inventory/repositories/inventory-valuation.repository'
import { getTodayAttendanceSummary } from '@/features/hr/repositories/attendance.repository'

export type DashboardBranch = { id: string; name: string; code: string }

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export type DashboardOverview = {
  kpis: {
    todaySales: number
    todayCollection: number
    todayExpenses: number
    netCashFlow: number
    customerDue: number
    supplierDue: number
    lowStockCount: number
    stockValuation: number | null
    stockCost: number | null
    onlineOrders?: number
    returnsToday?: number
    profitToday?: number
    grossProfit?: number
    cogsToday?: number
    totalProducts?: number
    trends: {
      sales: number | null
      collection: number | null
      expenses: number | null
      profit: number | null
      netCashFlow: number | null
    }
  }
  salesOverview: Array<{ date: string; label: string; sales: number; collection: number }>
  salesByCategory: Array<{ category: string; sales: number; count: number; percent: number }>
  categoryTotal: number
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
    invoiceNo?: string
    customerName?: string
    amount?: number
    paymentStatus?: string
  }>
  accounts: Array<{ id: string; name: string; balance: number }>
  refreshedAt?: string
}

type UntypedRpc = (fn: string, args?: object) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>
const untypedRpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc

export type DashboardQueryParams = {
  branchId?: string | null
  dateFrom?: string | null
  dateTo?: string | null
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

function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

function num(v: unknown): number {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

function mapRpcOverview(raw: Record<string, unknown>): DashboardOverview {
  const kpis = (raw.kpis ?? {}) as Record<string, unknown>
  const trends = (kpis.trends ?? {}) as Record<string, unknown>
  return {
    kpis: {
      todaySales: num(kpis.todaySales),
      todayCollection: num(kpis.todayCollection),
      todayExpenses: num(kpis.todayExpenses),
      netCashFlow: num(kpis.netCashFlow),
      customerDue: num(kpis.customerDue),
      supplierDue: num(kpis.supplierDue),
      lowStockCount: num(kpis.lowStockCount),
      stockValuation: kpis.stockValuation == null ? null : num(kpis.stockValuation),
      stockCost: kpis.stockCost == null ? null : num(kpis.stockCost),
      onlineOrders: num(kpis.onlineOrders),
      returnsToday: num(kpis.returnsToday),
      profitToday: num(kpis.profitToday),
      grossProfit: numOrNull(kpis.grossProfit) ?? undefined,
      cogsToday: numOrNull(kpis.cogsToday) ?? undefined,
      totalProducts: num(kpis.totalProducts),
      trends: {
        sales: numOrNull(trends.sales),
        collection: numOrNull(trends.collection),
        expenses: numOrNull(trends.expenses),
        profit: numOrNull(trends.profit),
        netCashFlow: numOrNull(trends.netCashFlow),
      },
    },
    salesOverview: ((raw.salesOverview ?? []) as Array<Record<string, unknown>>).map((d) => ({
      date: String(d.date ?? ''),
      label: String(d.label ?? ''),
      sales: num(d.sales),
      collection: num(d.collection),
    })),
    salesByCategory: ((raw.salesByCategory ?? []) as Array<Record<string, unknown>>).map((c) => ({
      category: String(c.category ?? 'Uncategorized'),
      sales: num(c.sales),
      count: num(c.count),
      percent: num(c.percent),
    })),
    categoryTotal: num(raw.categoryTotal),
    channelPerformance: ((raw.channelPerformance ?? []) as Array<Record<string, unknown>>).map((c) => ({
      channel: String(c.channel ?? 'other'),
      sales: num(c.sales),
      count: num(c.count),
    })),
    channelTotal: num(raw.channelTotal),
    orderStatuses: {
      pending: num((raw.orderStatuses as Record<string, unknown> | undefined)?.pending),
      readyToShip: num((raw.orderStatuses as Record<string, unknown> | undefined)?.readyToShip),
      courierBooked: num((raw.orderStatuses as Record<string, unknown> | undefined)?.courierBooked),
      inTransit: num((raw.orderStatuses as Record<string, unknown> | undefined)?.inTransit),
      deliveredToday: num((raw.orderStatuses as Record<string, unknown> | undefined)?.deliveredToday),
      returnedToday: num((raw.orderStatuses as Record<string, unknown> | undefined)?.returnedToday),
    },
    topProducts: ((raw.topProducts ?? []) as Array<Record<string, unknown>>).map((p) => ({
      rank: num(p.rank),
      productId: String(p.productId ?? ''),
      name: String(p.name ?? ''),
      qty: num(p.qty),
      revenue: num(p.revenue),
      image: String(p.image ?? ''),
    })),
    branchPerformance: ((raw.branchPerformance ?? []) as Array<Record<string, unknown>>).map((b) => ({
      id: String(b.id ?? ''),
      name: String(b.name ?? ''),
      sales: num(b.sales),
      collection: num(b.collection),
      profit: num(b.profit),
    })),
    lowStockProducts: ((raw.lowStockProducts ?? []) as Array<Record<string, unknown>>).map((p) => ({
      productId: String(p.productId ?? ''),
      productName: String(p.productName ?? ''),
      branchName: String(p.branchName ?? ''),
      qty: num(p.qty),
      image: String(p.image ?? ''),
    })),
    cashFlowTrend: ((raw.cashFlowTrend ?? []) as Array<Record<string, unknown>>).map((d) => ({
      date: String(d.date ?? ''),
      label: String(d.label ?? ''),
      income: num(d.income),
      expense: num(d.expense),
      profit: num(d.profit),
    })),
    attendanceToday: {
      present: num((raw.attendanceToday as Record<string, unknown> | undefined)?.present),
      late: num((raw.attendanceToday as Record<string, unknown> | undefined)?.late),
      absent: num((raw.attendanceToday as Record<string, unknown> | undefined)?.absent),
      leave: num((raw.attendanceToday as Record<string, unknown> | undefined)?.leave),
      employees: ((raw.attendanceToday as Record<string, unknown> | undefined)?.employees as Array<Record<string, unknown>> ?? []).map((e) => ({
        id: String(e.id ?? ''),
        name: String(e.name ?? ''),
        role: String(e.role ?? ''),
        status: String(e.status ?? ''),
        checkIn: String(e.checkIn ?? ''),
      })),
    },
    recentActivity: ((raw.recentActivity ?? []) as Array<Record<string, unknown>>).map((a) => ({
      id: String(a.id ?? ''),
      action: String(a.action ?? ''),
      userName: String(a.userName ?? ''),
      details: String(a.details ?? ''),
      created_at: String(a.created_at ?? ''),
      invoiceNo: a.invoiceNo != null ? String(a.invoiceNo) : undefined,
      customerName: a.customerName != null ? String(a.customerName) : undefined,
      amount: a.amount != null ? num(a.amount) : undefined,
      paymentStatus: a.paymentStatus != null ? String(a.paymentStatus) : undefined,
    })),
    accounts: ((raw.accounts ?? []) as Array<Record<string, unknown>>).map((a) => ({
      id: String(a.id ?? ''),
      name: String(a.name ?? ''),
      balance: num(a.balance),
    })),
    refreshedAt: raw.refreshedAt ? String(raw.refreshedAt) : undefined,
  }
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

async function getDashboardOverviewClient(params: DashboardQueryParams = {}): Promise<DashboardOverview> {
  const branchId = params.branchId ?? null
  const todayStart = params.dateFrom ?? dayStartIso()
  const todayEnd = params.dateTo ?? dayEndIso()
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
    valuationRes,
    attendanceRes,
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
        .select('id, invoice_no, grand_total, paid_total, due_total, created_at, customers(name)')
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
    getInventoryValuationSummary({ branchId: branchId ?? undefined }).catch(() => null),
    getTodayAttendanceSummary(branchId).catch(() => ({
      present: 0,
      late: 0,
      absent: 0,
      leave: 0,
      employees: [],
    })),
  ])

  if (recentSalesRes.error) throw recentSalesRes.error
  if (accountsRes.error) throw accountsRes.error

  const recentSales = recentSalesRes.data ?? []
  const netCashFlow = today.collection - todayExpenses
  const yesterdayNet = yesterday.collection - yesterdayExpenses
  // Fail closed on COGS: reuse accounting getProfitLoss (snapshot cost) — never sales−expenses alone.
  const { simpleAccountingRepository } = await import(
    '@/features/accounting/repositories/simple-accounting.repository'
  )
  const [plToday, plYesterday] = await Promise.all([
    simpleAccountingRepository.getProfitLoss({
      from: todayDate,
      to: todayDate,
      branchId,
    }),
    simpleAccountingRepository.getProfitLoss({
      from: yesterdayDate,
      to: yesterdayDate,
      branchId,
    }),
  ])
  const profitToday = plToday.netProfit
  const prevProfit = plYesterday.netProfit

  const { count: productCount } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)
    .is('deleted_at', null)

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
      stockValuation: valuationRes?.total_stock_value ?? null,
      stockCost: valuationRes?.total_stock_purchase_cost ?? null,
      profitToday,
      totalProducts: productCount ?? 0,
      onlineOrders: 0,
      returnsToday: 0,
      trends: {
        sales: pctChange(today.sales, yesterday.sales),
        collection: pctChange(today.collection, yesterday.collection),
        expenses: pctChange(todayExpenses, yesterdayExpenses),
        profit: pctChange(profitToday, prevProfit),
        netCashFlow: pctChange(netCashFlow, yesterdayNet),
      },
    },
    salesOverview,
    salesByCategory: [],
    categoryTotal: today.sales,
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
    attendanceToday: attendanceRes,
    recentActivity: recentSales.map((s) => {
      const cust = s.customers as unknown as { name: string } | null
      const due = Number((s as { due_total?: number }).due_total ?? 0) > 0.009
      return {
        id: s.id,
        action: 'Sale completed',
        userName: cust?.name ?? 'Walk-in',
        details: `${s.invoice_no} · ৳${Number(s.grand_total).toFixed(0)}`,
        created_at: s.created_at,
        invoiceNo: s.invoice_no ?? undefined,
        customerName: cust?.name ?? 'Walk-in',
        amount: Number(s.grand_total ?? 0),
        paymentStatus: due ? 'Due' : 'Paid',
      }
    }),
    accounts: (accountsRes.data ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      balance: Number(a.current_balance ?? 0),
    })),
    refreshedAt: new Date().toISOString(),
  }
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

export async function getDashboardOverview(params: DashboardQueryParams = {}): Promise<DashboardOverview> {
  const branchId = params.branchId ?? null
  const dateFrom = params.dateFrom ?? dayStartIso()
  const dateTo = params.dateTo ?? dayEndIso()

  const { data, error } = await untypedRpc('get_dashboard_overview', {
    p_branch_id: branchId,
    p_date_from: dateFrom,
    p_date_to: dateTo,
  })

  if (!error && data && typeof data === 'object') {
    return mapRpcOverview(data as Record<string, unknown>)
  }

  if (error && !/could not find|does not exist|42883|PGRST202/i.test(error.message)) {
    console.warn('get_dashboard_overview RPC failed, using client fallback', error.message)
  }

  return getDashboardOverviewClient({ branchId, dateFrom, dateTo })
}

export const dashboardRepository = {
  listDashboardBranches,
  getDashboardOverview,
}
