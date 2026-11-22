import { supabase } from '@/lib/supabase/client'
import { addDaysYmd, todayYmd, toQueryBounds } from '@/lib/datetime/bd'
import { downloadCsv } from '@/lib/format'

export type ReportRange = { from: string; to: string }

function defaultRange(): ReportRange {
  const to = todayYmd()
  return { from: addDaysYmd(to, -30), to }
}

function rangeBounds(range: ReportRange) {
  const b = toQueryBounds(range.from, range.to)
  return { fromIso: b.fromIso!, toIso: b.toIso! }
}

async function salesReport(range: ReportRange) {
  const { fromIso, toIso } = rangeBounds(range)
  const { data, error } = await supabase
    .from('sales')
    .select(
      'id, invoice_no, channel, grand_total, paid_total, due_total, completed_at, branch_id, salesperson_id, customers(name)',
    )
    .is('deleted_at', null)
    .eq('status', 'completed')
    .gte('completed_at', fromIso)
    .lte('completed_at', toIso)
    .order('completed_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

async function purchasesReport(range: ReportRange) {
  const { fromIso, toIso } = rangeBounds(range)
  const { data, error } = await supabase
    .from('purchases')
    .select('id, invoice_no, grand_total, paid_total, due_total, completed_at, suppliers(name)')
    .is('deleted_at', null)
    .eq('status', 'completed')
    .gte('completed_at', fromIso)
    .lte('completed_at', toIso)
    .order('completed_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

async function inventoryReport() {
  const { data, error } = await supabase
    .from('inventory_balances')
    .select(
      'id, quantity, average_unit_cost, variant_id, location_id, product_variants(sku, name, products(name)), stock_locations(name, branch_id)',
    )
    .is('deleted_at', null)
    .gt('quantity', 0)
    .order('quantity', { ascending: true })
    .limit(500)
  if (error) throw error
  return data ?? []
}

async function customerDueReport() {
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, phone, current_due, total_spent, total_paid')
    .is('deleted_at', null)
    .gt('current_due', 0)
    .order('current_due', { ascending: false })
  if (error) throw error
  return data ?? []
}

async function supplierDueReport() {
  const { data, error } = await supabase
    .from('suppliers')
    .select('id, name, phone, current_due')
    .is('deleted_at', null)
    .gt('current_due', 0)
    .order('current_due', { ascending: false })
  if (error) throw error
  return data ?? []
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
    // employees table may use different shape — fall back to profiles
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', unique)
    if (pErr) throw error
    return new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.id]))
  }
  return new Map((data ?? []).map((e) => [e.id, e.full_name || e.id]))
}

async function branchReport(range: ReportRange) {
  const sales = await salesReport(range)
  const map = new Map<string, { branchId: string; sales: number; total: number }>()
  for (const s of sales) {
    const key = s.branch_id || 'unknown'
    const cur = map.get(key) ?? { branchId: key, sales: 0, total: 0 }
    cur.sales += 1
    cur.total += Number(s.grand_total)
    map.set(key, cur)
  }
  const names = await loadBranchNames([...map.keys()])
  return [...map.values()]
    .map((r) => ({
      ...r,
      branchName: r.branchId === 'unknown' ? 'Unassigned' : names.get(r.branchId) || r.branchId,
    }))
    .sort((a, b) => b.total - a.total)
}

async function salespersonReport(range: ReportRange) {
  const sales = await salesReport(range)
  const map = new Map<string, { salespersonId: string; sales: number; total: number }>()
  for (const s of sales) {
    const key = s.salesperson_id || 'unassigned'
    const cur = map.get(key) ?? { salespersonId: key, sales: 0, total: 0 }
    cur.sales += 1
    cur.total += Number(s.grand_total)
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
    }))
    .sort((a, b) => b.total - a.total)
}

async function productPerformanceReport(range: ReportRange) {
  const { fromIso, toIso } = rangeBounds(range)
  const { data, error } = await supabase
    .from('sale_items')
    .select(
      `
      variant_id, qty, line_total, unit_price, cost_price,
      product_variants(sku, name, products(name)),
      sales!inner(completed_at, status, deleted_at)
    `,
    )
    .is('deleted_at', null)
    .eq('sales.status', 'completed')
    .is('sales.deleted_at', null)
    .gte('sales.completed_at', fromIso)
    .lte('sales.completed_at', toIso)
  if (error) throw error

  const map = new Map<
    string,
    { variantId: string; label: string; qty: number; revenue: number; cogs: number }
  >()
  for (const row of data ?? []) {
    const v = row.product_variants as unknown as {
      sku: string
      name: string | null
      products: { name: string } | null
    }
    const label = `${v?.products?.name ?? 'Product'} · ${v?.name || v?.sku || row.variant_id}`
    const cur = map.get(row.variant_id) ?? {
      variantId: row.variant_id,
      label,
      qty: 0,
      revenue: 0,
      cogs: 0,
    }
    const qty = Number(row.qty)
    cur.qty += qty
    cur.revenue += Number(row.line_total)
    cur.cogs += Number(row.cost_price ?? 0) * qty
    map.set(row.variant_id, cur)
  }
  return [...map.values()]
    .map((r) => ({
      ...r,
      grossProfit: r.revenue - r.cogs,
    }))
    .sort((a, b) => b.revenue - a.revenue)
}

async function courierReturnsReport(range: ReportRange) {
  const { fromIso, toIso } = rangeBounds(range)
  const { data, error } = await supabase
    .from('courier_return_requests')
    .select(
      'id, status, courier_reason, rejection_reason, created_at, reviewed_at, courier_companies(name), courier_parcels(tracking_no)',
    )
    .is('deleted_at', null)
    .gte('created_at', fromIso)
    .lte('created_at', toIso)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export function exportReportCsv(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
) {
  downloadCsv(filename, headers, rows)
}

export const reportsRepository = {
  defaultRange,
  salesReport,
  purchasesReport,
  inventoryReport,
  customerDueReport,
  supplierDueReport,
  branchReport,
  salespersonReport,
  productPerformanceReport,
  courierReturnsReport,
  exportReportCsv,
}
