import { approxEqual, NS } from './constants.mjs'
import { db } from './clients.mjs'

export async function reconcileDemo(ctx) {
  const database = db()
  const orgId = ctx.org.id
  const branchIds = ctx.selected.map((b) => b.id)
  const report = {
    namespace: NS,
    branches: ctx.selected.length,
    violations: [],
    counts: {},
    totals: {},
  }

  // Demo-scoped counts by client_txn_key prefix pattern
  const keyPattern = `${NS}::%`
  for (const table of ['sales', 'purchases']) {
    const { count, error } = await database
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .like('client_txn_key', keyPattern)
      .is('deleted_at', null)
    if (error) report.violations.push(`${table} count: ${error.message}`)
    else report.counts[table] = count ?? 0
  }

  const { count: expCount } = await database
    .from('expense_entries')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .like('reference', `CTX:${NS}::EXP::%`)
    .is('deleted_at', null)
  report.counts.expense_entries = expCount ?? 0

  // Transfers by DEMO-TRF prefix in transfer_no
  const { count: trfCount } = await database
    .from('stock_transfers')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .like('transfer_no', 'DEMO-TRF-%')
    .is('deleted_at', null)
  report.counts.stock_transfers = trfCount ?? 0

  // Demo suppliers/customers by notes marker
  for (const table of ['suppliers', 'customers']) {
    const { count } = await database
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .ilike('notes', `%${NS}%`)
      .is('deleted_at', null)
    report.counts[table] = count ?? 0
  }

  // Customer due reconciliation (demo customers only)
  const { data: demoCustomers } = await database
    .from('customers')
    .select('id, name, current_due')
    .eq('organization_id', orgId)
    .ilike('notes', `%${NS}%`)
    .is('deleted_at', null)

  let dueMismatch = 0
  for (const c of demoCustomers ?? []) {
    const { data: sales } = await database
      .from('sales')
      .select('due_total')
      .eq('customer_id', c.id)
      .is('deleted_at', null)
      .gt('due_total', 0)
    const invoiceDue = (sales ?? []).reduce((s, r) => s + Number(r.due_total), 0)
    if (!approxEqual(c.current_due, invoiceDue) && invoiceDue > 0) {
      dueMismatch += 1
    }
  }
  if (dueMismatch) report.violations.push(`${dueMismatch} demo customer(s) with invoice/due mismatch`)

  // Negative stock in selected branches
  const locationIds = [...ctx.branchMap.values()].map((b) => b.saleableLocationId)
  const { data: negStock } = await database
    .from('inventory_balances')
    .select('variant_id, quantity')
    .in('location_id', locationIds)
    .lt('quantity', 0)
    .is('deleted_at', null)
  if (negStock?.length) {
    report.violations.push(`${negStock.length} negative stock balance(s)`)
  }

  // Journal balance for demo sales/purchases (sample)
  const { data: journals } = await database
    .from('journal_entries')
    .select('id, source_type')
    .eq('organization_id', orgId)
    .in('source_type', ['sale', 'purchase', 'expense'])
    .is('deleted_at', null)
    .limit(200)

  let unbalanced = 0
  for (const je of journals ?? []) {
    const { data: lines } = await database
      .from('journal_lines')
      .select('debit, credit')
      .eq('journal_entry_id', je.id)
      .is('deleted_at', null)
    const debit = (lines ?? []).reduce((s, l) => s + Number(l.debit), 0)
    const credit = (lines ?? []).reduce((s, l) => s + Number(l.credit), 0)
    if (!approxEqual(debit, credit)) unbalanced += 1
  }
  if (unbalanced) report.violations.push(`${unbalanced} unbalanced journal(s) in sample`)

  // Branch-wise sales totals
  const { data: branchSales } = await database
    .from('sales')
    .select('branch_id, grand_total')
    .eq('organization_id', orgId)
    .like('client_txn_key', keyPattern)
    .is('deleted_at', null)

  const byBranch = {}
  for (const s of branchSales ?? []) {
    byBranch[s.branch_id] = (byBranch[s.branch_id] ?? 0) + Number(s.grand_total)
  }
  report.totals.salesByBranch = byBranch
  report.totals.demoSales = (branchSales ?? []).reduce((s, r) => s + Number(r.grand_total), 0)

  // Cross-org check
  const { data: crossOrg } = await database
    .from('sales')
    .select('id')
    .like('client_txn_key', keyPattern)
    .neq('organization_id', orgId)
    .is('deleted_at', null)
    .limit(1)
  if (crossOrg?.length) report.violations.push('cross-organization demo sales detected')

  report.ok = report.violations.length === 0
  return report
}

export function printReconciliation(report) {
  console.log('\n═══ Reconciliation ═══')
  console.log(`Namespace: ${report.namespace}`)
  console.log(`Branches seeded: ${report.branches}`)
  console.log('Counts:', JSON.stringify(report.counts, null, 2))
  console.log(`Demo sales total: ৳${Number(report.totals.demoSales ?? 0).toFixed(2)}`)
  if (report.violations.length) {
    console.log('Violations:')
    report.violations.forEach((v) => console.log(`  ✖ ${v}`))
  } else {
    console.log('✓ No reconciliation violations in automated checks')
  }
  console.log('═══════════════════════\n')
}

export function compareReports(before, after) {
  const diffs = []
  for (const key of Object.keys(before.counts)) {
    if (before.counts[key] !== after.counts[key]) {
      diffs.push(`${key}: ${before.counts[key]} → ${after.counts[key]}`)
    }
  }
  if (Math.abs((before.totals.demoSales ?? 0) - (after.totals.demoSales ?? 0)) > 0.01) {
    diffs.push(`demoSales total changed`)
  }
  return diffs
}
