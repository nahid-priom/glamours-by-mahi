import { supabase } from '@/lib/supabase/client'
import { toQueryBounds } from '@/lib/datetime/bd'
import { downloadCsv } from '@/lib/format'
import { defaultPeriodRange } from '../reports.filters'

export type ReportRange = { from: string; to: string }

export type SalesReportFilters = ReportRange & {
  branchId?: string | null
  customerId?: string | null
  salespersonId?: string | null
  search?: string | null
  channel?: string | null
}

export type InventoryReportPage = {
  rows: InventoryBalanceRow[]
  totalCount: number
  page: number
  pageSize: number
  qtyTotal: number
  costTotal: number
}

type InventoryBalanceRow = {
  id: string
  quantity: number
  average_unit_cost: number | null
  variant_id: string
  location_id: string
  product_variants: unknown
  stock_locations: unknown
}

function defaultRange(): ReportRange {
  return defaultPeriodRange()
}

function rangeBounds(range: ReportRange) {
  const b = toQueryBounds(range.from, range.to)
  return { fromIso: b.fromIso!, toIso: b.toIso! }
}

async function salesReport(filters: SalesReportFilters) {
  const { fromIso, toIso } = rangeBounds(filters)
  let q = supabase
    .from('sales')
    .select(
      'id, invoice_no, channel, order_source, subtotal, discount, tax, shipping, grand_total, paid_total, due_total, completed_at, branch_id, salesperson_id, customer_id, customers(name)',
    )
    .is('deleted_at', null)
    .eq('status', 'completed')
    .gte('completed_at', fromIso)
    .lte('completed_at', toIso)
    .order('completed_at', { ascending: false })

  if (filters.branchId) q = q.eq('branch_id', filters.branchId)
  if (filters.customerId) q = q.eq('customer_id', filters.customerId)
  if (filters.salespersonId) q = q.eq('salesperson_id', filters.salespersonId)
  if (filters.channel) q = q.eq('order_source', filters.channel)

  const { data, error } = await q
  if (error) throw error

  const needle = filters.search?.trim().toLowerCase()
  if (!needle) return data ?? []

  return (data ?? []).filter((r) => {
    const c = r.customers as unknown as { name?: string } | null
    return (
      r.invoice_no?.toLowerCase().includes(needle) ||
      (c?.name || '').toLowerCase().includes(needle) ||
      (r.order_source || '').toLowerCase().includes(needle)
    )
  })
}

/** Full-filter sales KPIs from the same completed-sales set (not page slice). */
async function salesRegisterSummary(filters: SalesReportFilters) {
  const rows = await salesReport(filters)
  const returns = await salesReturnsReport({
    from: filters.from,
    to: filters.to,
    branchId: filters.branchId,
  })
  const returnValue = returns.reduce((s, r) => s + Number(r.total ?? 0), 0)
  const gross = rows.reduce((s, r) => s + Number(r.subtotal ?? r.grand_total ?? 0), 0)
  const discount = rows.reduce((s, r) => s + Number(r.discount ?? 0), 0)
  const netDoc = rows.reduce((s, r) => s + Number(r.grand_total ?? 0), 0)
  const paid = rows.reduce((s, r) => s + Number(r.paid_total ?? 0), 0)
  const due = rows.reduce((s, r) => s + Number(r.due_total ?? 0), 0)
  return {
    transactions: rows.length,
    grossSales: gross,
    totalDiscount: discount,
    salesReturns: returnValue,
    netSales: Math.max(0, netDoc - returnValue),
    receivedAmount: paid,
    outstandingAmount: due,
  }
}

export type ReturnsReportFilters = ReportRange & {
  branchId?: string | null
  status?: string | null
  search?: string | null
}

async function salesReturnsReport(filters: ReturnsReportFilters) {
  const { fromIso, toIso } = rangeBounds(filters)
  let q = supabase
    .from('sale_returns')
    .select(
      `id, return_no, status, total, reason, created_at, approved_at, branch_id, sale_id,
       sales(invoice_no, customers(name)),
       sale_return_items(id, qty, line_total, unit_price, condition, variant_id, product_variants(sku, name, products(name)))`,
    )
    .is('deleted_at', null)
    .gte('created_at', fromIso)
    .lte('created_at', toIso)
    .order('created_at', { ascending: false })

  if (filters.status) {
    q = q.eq('status', filters.status)
  } else {
    q = q.in('status', ['approved', 'completed'])
  }
  if (filters.branchId) q = q.eq('branch_id', filters.branchId)

  const { data, error } = await q
  if (error) throw error

  const needle = filters.search?.trim().toLowerCase()
  if (!needle) return data ?? []

  return (data ?? []).filter((r) => {
    const sale = r.sales as unknown as {
      invoice_no?: string
      customers?: { name?: string } | null
    } | null
    return (
      r.return_no?.toLowerCase().includes(needle) ||
      (sale?.invoice_no || '').toLowerCase().includes(needle) ||
      (sale?.customers?.name || '').toLowerCase().includes(needle) ||
      (r.reason || '').toLowerCase().includes(needle)
    )
  })
}

async function channelPerformanceReport(filters: SalesReportFilters) {
  const sales = await salesReport(filters)
  const map = new Map<string, { channel: string; orders: number; revenue: number; due: number }>()
  for (const s of sales) {
    // Authoritative: order_source only — never free-text channel fallback
    const key = (s.order_source || 'other').toLowerCase() || 'other'
    const cur = map.get(key) ?? { channel: key, orders: 0, revenue: 0, due: 0 }
    cur.orders += 1
    cur.revenue += Number(s.grand_total)
    cur.due += Number(s.due_total)
    map.set(key, cur)
  }
  return [...map.values()]
    .map((r) => ({
      ...r,
      avgOrderValue: r.orders > 0 ? r.revenue / r.orders : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
}

export type CodSettlementFilters = ReportRange & { status?: string | null }

async function codSettlementReport(filters: CodSettlementFilters) {
  const { fromIso, toIso } = rangeBounds(filters)
  let q = supabase
    .from('courier_settlements')
    .select(
      'id, status, cod_amount, courier_charge, return_charge, settlement_amount, settlement_date, created_at, courier_companies(name), courier_parcels(tracking_no)',
    )
    .is('deleted_at', null)
    .gte('created_at', fromIso)
    .lte('created_at', toIso)
    .order('created_at', { ascending: false })

  if (filters.status) q = q.eq('status', filters.status)

  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

async function customerDueTotal(): Promise<number> {
  const rows = await customerDueReport()
  return rows.reduce((s, r) => s + Number(r.current_due ?? 0), 0)
}

export type PurchasesReportFilters = ReportRange & {
  branchId?: string | null
  supplierId?: string | null
  search?: string | null
}

async function purchasesReport(filters: PurchasesReportFilters) {
  const { fromIso, toIso } = rangeBounds(filters)
  let q = supabase
    .from('purchases')
    .select(
      'id, invoice_no, grand_total, paid_total, due_total, discount, completed_at, branch_id, supplier_id, suppliers(name)',
    )
    .is('deleted_at', null)
    .eq('status', 'completed')
    .gte('completed_at', fromIso)
    .lte('completed_at', toIso)
    .order('completed_at', { ascending: false })

  if (filters.branchId) q = q.eq('branch_id', filters.branchId)
  if (filters.supplierId) q = q.eq('supplier_id', filters.supplierId)

  const { data, error } = await q
  if (error) throw error

  const needle = filters.search?.trim().toLowerCase()
  if (!needle) return data ?? []

  return (data ?? []).filter((r) => {
    const s = r.suppliers as unknown as { name?: string } | null
    return (
      r.invoice_no?.toLowerCase().includes(needle) ||
      (s?.name || '').toLowerCase().includes(needle)
    )
  })
}

async function purchasesRegisterSummary(filters: PurchasesReportFilters) {
  const rows = await purchasesReport(filters)
  return {
    transactions: rows.length,
    grossPurchases: rows.reduce((s, r) => s + Number(r.grand_total ?? 0) + Number(r.discount ?? 0), 0),
    purchaseDiscount: rows.reduce((s, r) => s + Number(r.discount ?? 0), 0),
    netPurchases: rows.reduce((s, r) => s + Number(r.grand_total ?? 0), 0),
    paidAmount: rows.reduce((s, r) => s + Number(r.paid_total ?? 0), 0),
    outstandingAmount: rows.reduce((s, r) => s + Number(r.due_total ?? 0), 0),
  }
}

export type InventoryListFilters = {
  branchId?: string | null
  search?: string | null
  page?: number
  pageSize?: number
}

async function inventoryReport(
  filters: InventoryListFilters = {},
): Promise<InventoryReportPage> {
  const page = Math.max(1, filters.page ?? 1)
  const pageSize = Math.min(200, Math.max(25, filters.pageSize ?? 50))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  // Totals query (authoritative across matching rows, not the visible page)
  type TotalsRow = { quantity: number; average_unit_cost: number | null }
  let allForTotals: TotalsRow[] = []
  let count: number | null = null

  if (filters.branchId) {
    const { data, error: totalsErr, count: c } = await supabase
      .from('inventory_balances')
      .select('quantity, average_unit_cost, stock_locations!inner(branch_id)', { count: 'exact' })
      .is('deleted_at', null)
      .gt('quantity', 0)
      .eq('stock_locations.branch_id', filters.branchId)
    if (totalsErr) throw totalsErr
    allForTotals = (data ?? []) as unknown as TotalsRow[]
    count = c
  } else {
    const { data, error: totalsErr, count: c } = await supabase
      .from('inventory_balances')
      .select('quantity, average_unit_cost', { count: 'exact' })
      .is('deleted_at', null)
      .gt('quantity', 0)
    if (totalsErr) throw totalsErr
    allForTotals = (data ?? []) as TotalsRow[]
    count = c
  }

  const qtyTotal = allForTotals.reduce((s, r) => s + Number(r.quantity ?? 0), 0)
  const costTotal = allForTotals.reduce(
    (s, r) => s + Number(r.quantity ?? 0) * Number(r.average_unit_cost ?? 0),
    0,
  )

  let pageQ = filters.branchId
    ? supabase
        .from('inventory_balances')
        .select(
          'id, quantity, average_unit_cost, variant_id, location_id, product_variants(sku, name, barcode, products(name, brand_id)), stock_locations!inner(name, branch_id)',
        )
        .is('deleted_at', null)
        .gt('quantity', 0)
        .eq('stock_locations.branch_id', filters.branchId)
        .order('quantity', { ascending: true })
        .range(from, to)
    : supabase
        .from('inventory_balances')
        .select(
          'id, quantity, average_unit_cost, variant_id, location_id, product_variants(sku, name, barcode, products(name, brand_id)), stock_locations(name, branch_id)',
        )
        .is('deleted_at', null)
        .gt('quantity', 0)
        .order('quantity', { ascending: true })
        .range(from, to)

  const { data, error } = await pageQ
  if (error) throw error

  let rows = (data ?? []) as unknown as InventoryBalanceRow[]
  const needle = filters.search?.trim().toLowerCase()
  if (needle) {
    rows = rows.filter((r) => {
      const v = r.product_variants as unknown as {
        sku?: string
        name?: string | null
        products?: { name?: string } | null
      } | null
      return (
        (v?.sku || '').toLowerCase().includes(needle) ||
        (v?.name || '').toLowerCase().includes(needle) ||
        (v?.products?.name || '').toLowerCase().includes(needle)
      )
    })
  }

  return {
    rows,
    totalCount: count ?? rows.length,
    page,
    pageSize,
    qtyTotal,
    costTotal,
  }
}

async function customerDueReport(search?: string | null) {
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, phone, current_due, total_spent, total_paid')
    .is('deleted_at', null)
    .gt('current_due', 0)
    .order('current_due', { ascending: false })
  if (error) throw error
  const needle = search?.trim().toLowerCase()
  if (!needle) return data ?? []
  return (data ?? []).filter(
    (r) =>
      r.name?.toLowerCase().includes(needle) ||
      (r.phone || '').toLowerCase().includes(needle),
  )
}

async function supplierDueReport(search?: string | null) {
  const { data, error } = await supabase
    .from('suppliers')
    .select('id, name, phone, current_due')
    .is('deleted_at', null)
    .gt('current_due', 0)
    .order('current_due', { ascending: false })
  if (error) throw error
  const needle = search?.trim().toLowerCase()
  if (!needle) return data ?? []
  return (data ?? []).filter(
    (r) =>
      r.name?.toLowerCase().includes(needle) ||
      (r.phone || '').toLowerCase().includes(needle),
  )
}

async function loadBranchNames(ids: string[]) {
  const unique = [...new Set(ids.filter((id) => id && id !== 'unknown'))]
  if (!unique.length) return new Map<string, string>()
  const { data, error } = await supabase.from('branches').select('id, name').in('id', unique)
  if (error) throw error
  return new Map((data ?? []).map((b) => [b.id, b.name]))
}

async function loadSalespersonNames(ids: string[]) {
  const unique = [...new Set(ids.filter((id) => id && id !== 'unassigned'))]
  if (!unique.length) return new Map<string, string>()
  const { data, error } = await supabase
    .from('employees')
    .select('id, full_name')
    .in('id', unique)
  if (error) {
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', unique)
    if (pErr) throw error
    return new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.id]))
  }
  return new Map((data ?? []).map((e) => [e.id, e.full_name || e.id]))
}

async function branchReport(filters: SalesReportFilters) {
  const sales = await salesReport(filters)
  const map = new Map<
    string,
    { branchId: string; sales: number; total: number; discount: number; due: number }
  >()
  for (const s of sales) {
    const key = s.branch_id || 'unknown'
    const cur = map.get(key) ?? { branchId: key, sales: 0, total: 0, discount: 0, due: 0 }
    cur.sales += 1
    cur.total += Number(s.grand_total)
    cur.discount += Number(s.discount ?? 0)
    cur.due += Number(s.due_total ?? 0)
    map.set(key, cur)
  }
  const names = await loadBranchNames([...map.keys()])
  const grand = [...map.values()].reduce((s, r) => s + r.total, 0)
  return [...map.values()]
    .map((r) => ({
      ...r,
      branchName: r.branchId === 'unknown' ? 'Unassigned' : names.get(r.branchId) || r.branchId,
      contributionPct: grand > 0 ? (r.total / grand) * 100 : 0,
      avgTransaction: r.sales > 0 ? r.total / r.sales : 0,
    }))
    .sort((a, b) => b.total - a.total)
}

async function salespersonReport(filters: SalesReportFilters) {
  const sales = await salesReport(filters)
  const map = new Map<
    string,
    { salespersonId: string; sales: number; total: number; due: number }
  >()
  for (const s of sales) {
    const key = s.salesperson_id || 'unassigned'
    const cur = map.get(key) ?? { salespersonId: key, sales: 0, total: 0, due: 0 }
    cur.sales += 1
    cur.total += Number(s.grand_total)
    cur.due += Number(s.due_total ?? 0)
    map.set(key, cur)
  }
  const names = await loadSalespersonNames([...map.keys()])
  return [...map.values()]
    .map((r) => ({
      ...r,
      salespersonName:
        r.salespersonId === 'unassigned'
          ? 'Unassigned'
          : names.get(r.salespersonId) || r.salespersonId,
      avgTransaction: r.sales > 0 ? r.total / r.sales : 0,
    }))
    .sort((a, b) => b.total - a.total)
}

async function productPerformanceReport(
  filters: SalesReportFilters,
  level: 'product' | 'variant' = 'variant',
) {
  const { fromIso, toIso } = rangeBounds(filters)
  let q = supabase
    .from('sale_items')
    .select(
      `
      variant_id, qty, line_total, unit_price, cost_price,
      product_variants(sku, name, products(id, name)),
      sales!inner(completed_at, status, deleted_at, branch_id, order_source)
    `,
    )
    .is('deleted_at', null)
    .eq('sales.status', 'completed')
    .is('sales.deleted_at', null)
    .gte('sales.completed_at', fromIso)
    .lte('sales.completed_at', toIso)

  if (filters.branchId) q = q.eq('sales.branch_id', filters.branchId)

  const { data, error } = await q
  if (error) throw error

  // Net returns qty/value for same period (posted returns only)
  const returns = await salesReturnsReport({
    from: filters.from,
    to: filters.to,
    branchId: filters.branchId,
  })
  const returnByVariant = new Map<string, { qty: number; value: number }>()
  for (const ret of returns) {
    const items = (ret.sale_return_items ?? []) as unknown as Array<{
      variant_id: string
      qty: number
      line_total: number
    }>
    for (const it of items) {
      const cur = returnByVariant.get(it.variant_id) ?? { qty: 0, value: 0 }
      cur.qty += Number(it.qty)
      cur.value += Number(it.line_total)
      returnByVariant.set(it.variant_id, cur)
    }
  }

  type Agg = {
    key: string
    label: string
    sku: string
    variantName: string
    qty: number
    returnedQty: number
    revenue: number
    returnValue: number
    cogs: number
  }
  const map = new Map<string, Agg>()
  for (const row of data ?? []) {
    const v = row.product_variants as unknown as {
      sku: string
      name: string | null
      products: { id: string; name: string } | null
    }
    const productId = v?.products?.id ?? 'unknown'
    const key = level === 'product' ? productId : row.variant_id
    const label =
      level === 'product'
        ? v?.products?.name ?? 'Product'
        : `${v?.products?.name ?? 'Product'} · ${v?.name || v?.sku || row.variant_id}`
    const cur = map.get(key) ?? {
      key,
      label,
      sku: v?.sku || '',
      variantName: v?.name || '',
      qty: 0,
      returnedQty: 0,
      revenue: 0,
      returnValue: 0,
      cogs: 0,
    }
    const qty = Number(row.qty)
    cur.qty += qty
    cur.revenue += Number(row.line_total)
    cur.cogs += Number(row.cost_price ?? 0) * qty
    map.set(key, cur)
  }

  // Apply return netting at variant grain; for product grain, fold variant returns
  if (level === 'variant') {
    for (const [variantId, ret] of returnByVariant) {
      const cur = map.get(variantId)
      if (!cur) continue
      cur.returnedQty += ret.qty
      cur.returnValue += ret.value
    }
  } else {
    for (const row of data ?? []) {
      const v = row.product_variants as unknown as {
        products: { id: string } | null
      }
      const productId = v?.products?.id ?? 'unknown'
      const ret = returnByVariant.get(row.variant_id)
      if (!ret) continue
      const cur = map.get(productId)
      if (!cur) continue
      // Avoid double-counting: only apply once per variant per product
    }
    const applied = new Set<string>()
    for (const [variantId, ret] of returnByVariant) {
      // Find product key via any sale_item with this variant
      for (const row of data ?? []) {
        if (row.variant_id !== variantId) continue
        const v = row.product_variants as unknown as {
          products: { id: string } | null
        }
        const productId = v?.products?.id ?? 'unknown'
        const dedupe = `${productId}:${variantId}`
        if (applied.has(dedupe)) break
        applied.add(dedupe)
        const cur = map.get(productId)
        if (!cur) break
        cur.returnedQty += ret.qty
        cur.returnValue += ret.value
        break
      }
    }
  }

  return [...map.values()]
    .map((r) => {
      const netQty = r.qty - r.returnedQty
      const netRevenue = Math.max(0, r.revenue - r.returnValue)
      // Approximate returned COGS proportionally by qty when returns exist
      const returnedCogs =
        r.qty > 0 && r.returnedQty > 0 ? (r.cogs / r.qty) * r.returnedQty : 0
      const netCogs = Math.max(0, r.cogs - returnedCogs)
      const grossProfit = netRevenue - netCogs
      const marginPct = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0
      return {
        ...r,
        variantId: r.key,
        netQty,
        netRevenue,
        netCogs,
        grossProfit,
        marginPct,
      }
    })
    .sort((a, b) => b.netRevenue - a.netRevenue)
}

export type CourierReturnsFilters = ReportRange & { status?: string | null }

async function courierReturnsReport(filters: CourierReturnsFilters) {
  const { fromIso, toIso } = rangeBounds(filters)
  let q = supabase
    .from('courier_return_requests')
    .select(
      'id, status, courier_reason, rejection_reason, created_at, reviewed_at, courier_companies(name), courier_parcels(tracking_no)',
    )
    .is('deleted_at', null)
    .gte('created_at', fromIso)
    .lte('created_at', toIso)
    .order('created_at', { ascending: false })

  if (filters.status) q = q.eq('status', filters.status)

  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

async function supplierDueTotal(): Promise<number> {
  const rows = await supplierDueReport()
  return rows.reduce((s, r) => s + Number(r.current_due ?? 0), 0)
}

async function outstandingCodSettlementTotal(range: ReportRange): Promise<number> {
  const rows = await codSettlementReport({ ...range, status: 'pending' })
  return rows.reduce((s, r) => s + Number(r.cod_amount ?? 0), 0)
}

/**
 * Export CSV with spreadsheet-injection guard.
 * Leading = + - @ are prefixed with a single quote.
 */
export function exportReportCsv(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
) {
  const sanitize = (cell: string | number): string | number => {
    if (typeof cell !== 'string') return cell
    if (/^[=+\-@]/.test(cell)) return `'${cell}`
    return cell
  }
  downloadCsv(
    filename,
    headers,
    rows.map((row) => row.map(sanitize)),
  )
}

export const reportsRepository = {
  defaultRange,
  salesReport,
  salesRegisterSummary,
  salesReturnsReport,
  channelPerformanceReport,
  codSettlementReport,
  customerDueTotal,
  supplierDueTotal,
  outstandingCodSettlementTotal,
  purchasesReport,
  purchasesRegisterSummary,
  inventoryReport,
  customerDueReport,
  supplierDueReport,
  branchReport,
  salespersonReport,
  productPerformanceReport,
  courierReturnsReport,
  exportReportCsv,
}
