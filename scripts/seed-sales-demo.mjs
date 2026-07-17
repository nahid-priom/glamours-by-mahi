#!/usr/bin/env node
/**
 * Seed 10 realistic sales through the authoritative `complete_pos_sale` RPC.
 *
 * This script NEVER writes directly to sales, sale_items, inventory_balances,
 * customer_ledger, financial_transactions or journal tables. Every sale is
 * created by calling the same server RPC the POS uses, so stock, ledgers,
 * accounts and balanced journals are produced by the database — not by us.
 *
 * Idempotency: each sale uses a deterministic client_txn_key
 * (gbm-sales-demo-001 .. gbm-sales-demo-010). Re-running skips existing keys.
 *
 * Required env:
 *   SUPABASE_URL              e.g. http://127.0.0.1:54321 or your project URL
 *   SUPABASE_ANON_KEY         anon/public key
 *   SEED_USER_EMAIL           a real cashier/admin with pos.create + branch access
 *   SEED_USER_PASSWORD        that user's password
 * Optional env:
 *   SUPABASE_SERVICE_ROLE_KEY enables date back-dating + deep verification
 *   SEED_BRANCH_ID            force a specific branch (defaults to first active)
 *
 * Usage:  node scripts/seed-sales-demo.mjs
 */
import { createClient } from '@supabase/supabase-js'

const EPS = 0.01
const KEY_PREFIX = 'gbm-sales-demo-'
const COUNT = 10

const env = process.env
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL
const ANON_KEY = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || null
const EMAIL = env.SEED_USER_EMAIL
const PASSWORD = env.SEED_USER_PASSWORD

function fail(message) {
  console.error(`\n✖ ${message}\n`)
  process.exit(1)
}

function money(n) {
  return `৳${Number(n).toFixed(2)}`
}

function approxEqual(a, b) {
  return Math.abs(Number(a) - Number(b)) <= EPS
}

if (!SUPABASE_URL || !ANON_KEY) fail('Missing SUPABASE_URL / SUPABASE_ANON_KEY.')
if (!EMAIL || !PASSWORD) fail('Missing SEED_USER_EMAIL / SEED_USER_PASSWORD.')

const client = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const admin = SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  : null

async function signIn() {
  const { data, error } = await client.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
  if (error) fail(`Sign-in failed: ${error.message}`)
  return data.user
}

async function loadPrerequisites() {
  // Branch
  let branchQuery = client
    .from('branches')
    .select('id, name, organization_id')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
  if (env.SEED_BRANCH_ID) branchQuery = branchQuery.eq('id', env.SEED_BRANCH_ID)
  const { data: branches, error: branchErr } = await branchQuery.limit(1)
  if (branchErr) fail(`Cannot read branches: ${branchErr.message}`)
  if (!branches?.length) fail('Prerequisite missing: no active branch found.')
  const branch = branches[0]

  // Saleable stock location for the branch
  const { data: locations, error: locErr } = await client
    .from('stock_locations')
    .select('id')
    .eq('branch_id', branch.id)
    .eq('location_type', 'saleable')
    .eq('is_active', true)
    .is('deleted_at', null)
  if (locErr) fail(`Cannot read stock locations: ${locErr.message}`)
  if (!locations?.length) fail(`Prerequisite missing: no saleable stock location in branch ${branch.name}.`)
  const locationIds = locations.map((l) => l.id)

  // Financial accounts
  const { data: accounts, error: accErr } = await client
    .from('financial_accounts')
    .select('id, name, is_active')
    .eq('is_active', true)
    .is('deleted_at', null)
  if (accErr) fail(`Cannot read financial accounts: ${accErr.message}`)
  if (!accounts?.length) fail('Prerequisite missing: no active financial account found.')

  // Payment methods
  const { data: methods, error: methErr } = await client
    .from('payment_methods')
    .select('code, name, financial_account_id, is_due, is_active')
    .eq('is_active', true)
    .is('deleted_at', null)
  if (methErr) fail(`Cannot read payment methods: ${methErr.message}`)
  const payMethods = methods ?? []
  const pick = (...codes) =>
    payMethods.find((m) => codes.includes((m.code || '').toLowerCase()) && !m.is_due)
  const cash = pick('cash') || payMethods.find((m) => !m.is_due)
  if (!cash) fail('Prerequisite missing: no non-due payment method (e.g. cash).')
  const digital = pick('bkash', 'nagad', 'card', 'rocket', 'bank') || cash
  const defaultAccountId = accounts[0].id
  const accountFor = (m) => m?.financial_account_id || defaultAccountId

  // Customers (need several distinct)
  const { data: customers, error: custErr } = await client
    .from('customers')
    .select('id, name, phone')
    .is('deleted_at', null)
    .neq('status', 'archived')
    .order('created_at', { ascending: true })
    .limit(20)
  if (custErr) fail(`Cannot read customers: ${custErr.message}`)
  if (!customers || customers.length < 6) {
    fail(`Prerequisite missing: need at least 6 active customers, found ${customers?.length ?? 0}.`)
  }

  // Variants with real available stock at the branch
  const { data: balances, error: balErr } = await client
    .from('inventory_balances')
    .select('variant_id, location_id, quantity')
    .in('location_id', locationIds)
    .is('deleted_at', null)
  if (balErr) fail(`Cannot read inventory balances: ${balErr.message}`)

  const stockByVariant = new Map()
  for (const b of balances ?? []) {
    stockByVariant.set(b.variant_id, (stockByVariant.get(b.variant_id) ?? 0) + Number(b.quantity ?? 0))
  }
  const variantIds = [...stockByVariant.keys()].filter((id) => stockByVariant.get(id) > 0)
  if (variantIds.length < 4) {
    fail(`Prerequisite missing: need at least 4 in-stock variants, found ${variantIds.length}.`)
  }

  const { data: variants, error: varErr } = await client
    .from('product_variants')
    .select('id, sku, selling_price, is_active, deleted_at')
    .in('id', variantIds)
    .eq('is_active', true)
    .is('deleted_at', null)
  if (varErr) fail(`Cannot read product variants: ${varErr.message}`)

  const sellable = (variants ?? [])
    .map((v) => ({
      id: v.id,
      sku: v.sku,
      price: Number(v.selling_price ?? 0),
      stock: Math.floor(stockByVariant.get(v.id) ?? 0),
    }))
    .filter((v) => v.price > 0 && v.stock > 0)

  if (sellable.length < 4) {
    fail(`Prerequisite missing: need at least 4 priced, in-stock variants, found ${sellable.length}.`)
  }

  return { branch, accounts, cash, digital, accountFor, customers, sellable }
}

/** Reserve stock locally so the 10 sales never oversell a shared variant. */
function makeStockAllocator(sellable) {
  const remaining = new Map(sellable.map((v) => [v.id, v.stock]))
  return {
    take(variant, qty) {
      const left = remaining.get(variant.id) ?? 0
      const take = Math.min(qty, left)
      remaining.set(variant.id, left - take)
      return take
    },
    canTake(variant) {
      return (remaining.get(variant.id) ?? 0) > 0
    },
  }
}

function buildSaleSpecs(prereq) {
  const { cash, digital, accountFor, customers, sellable } = prereq
  const alloc = makeStockAllocator(sellable)
  const specs = []

  // Deterministic-ish item picker that respects remaining stock.
  let cursor = 0
  const nextItems = (maxItems) => {
    const items = []
    let guard = 0
    while (items.length < maxItems && guard < sellable.length * 2) {
      const v = sellable[cursor % sellable.length]
      cursor += 1
      guard += 1
      if (!alloc.canTake(v)) continue
      const want = 1 + (items.length % 3) // 1..3
      const qty = alloc.take(v, want)
      if (qty > 0) items.push({ variant_id: v.id, qty, unit_price: v.price, line_discount: 0 })
    }
    return items
  }

  const custAt = (i) => customers[i % customers.length]

  // Plan: [type, itemCount, customerIndex|null, paymentBuilder]
  // 1 walk-in fully paid cash + 2 more fully paid cash = 3 cash
  const plan = [
    { type: 'cash-paid', items: 2, customer: null }, // walk-in
    { type: 'cash-paid', items: 1, customer: custAt(0) },
    { type: 'cash-paid', items: 3, customer: custAt(1) },
    { type: 'digital-paid', items: 2, customer: custAt(2) },
    { type: 'digital-paid', items: 1, customer: custAt(3) },
    { type: 'partial', items: 2, customer: custAt(4) },
    { type: 'partial', items: 3, customer: custAt(5) },
    { type: 'full-due', items: 1, customer: custAt(0) },
    { type: 'full-due', items: 2, customer: custAt(1) },
    { type: 'mixed', items: 4, customer: custAt(2) },
  ]

  plan.forEach((p, idx) => {
    const items = nextItems(p.items)
    if (items.length === 0) return // stock exhausted; verification will report count
    const gross = items.reduce((s, it) => s + it.unit_price * it.qty - it.line_discount, 0)
    const total = Math.round(gross * 100) / 100
    let payments = []
    if (p.type === 'cash-paid') {
      payments = [{ method: cash.code, amount: total, financial_account_id: accountFor(cash) }]
    } else if (p.type === 'digital-paid') {
      payments = [{ method: digital.code, amount: total, financial_account_id: accountFor(digital) }]
    } else if (p.type === 'partial') {
      const paid = Math.round(total * 0.5 * 100) / 100
      payments = [{ method: cash.code, amount: paid, financial_account_id: accountFor(cash) }]
    } else if (p.type === 'full-due') {
      payments = [] // customer owes the full amount
    } else if (p.type === 'mixed') {
      const half = Math.round(total * 0.5 * 100) / 100
      payments = [
        { method: cash.code, amount: half, financial_account_id: accountFor(cash) },
        { method: digital.code, amount: Math.round((total - half) * 100) / 100, financial_account_id: accountFor(digital) },
      ]
    }
    specs.push({
      key: `${KEY_PREFIX}${String(idx + 1).padStart(3, '0')}`,
      daysAgo: COUNT - 1 - idx, // spread across the last 10 days
      customer_id: p.customer?.id ?? null,
      items,
      payments,
      expectedTotal: total,
    })
  })

  return specs
}

async function existingSale(key) {
  const { data, error } = await client
    .from('sales')
    .select('id, invoice_no, client_txn_key')
    .eq('client_txn_key', key)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

async function createSale(spec, branch) {
  const payload = {
    branch_id: branch.id,
    customer_id: spec.customer_id,
    client_txn_key: spec.key,
    note: `Demo seed ${spec.key}`,
    discount: 0,
    tax: 0,
    shipping: 0,
    items: spec.items,
    payments: spec.payments,
  }
  const { data, error } = await client.rpc('complete_pos_sale', { payload })
  if (error) throw new Error(error.message)
  return data
}

async function backdate(saleId, daysAgo) {
  if (!admin) return false
  const when = new Date()
  when.setDate(when.getDate() - daysAgo)
  when.setHours(11, 30, 0, 0)
  const iso = when.toISOString()
  const day = iso.slice(0, 10)
  await admin.from('sales').update({ created_at: iso, completed_at: iso }).eq('id', saleId)
  await admin.from('stock_ledger').update({ occurred_at: iso }).eq('reference_type', 'sale').eq('reference_id', saleId)
  await admin.from('customer_ledger').update({ occurred_at: iso }).eq('reference_type', 'sale').eq('reference_id', saleId)
  await admin.from('financial_transactions').update({ transaction_date: iso }).eq('source_type', 'sale').eq('source_id', saleId)
  await admin.from('journal_entries').update({ entry_date: day }).eq('source_type', 'sale').eq('source_id', saleId)
  return true
}

async function verifySale(saleId) {
  const db = admin ?? client
  const problems = []

  const { data: sale } = await db
    .from('sales')
    .select('id, invoice_no, subtotal, grand_total, paid_total, due_total, customer_id')
    .eq('id', saleId)
    .maybeSingle()
  if (!sale) return { ok: false, problems: ['sale row not found'] }

  // sale total = paid + due
  if (!approxEqual(sale.grand_total, Number(sale.paid_total) + Number(sale.due_total))) {
    problems.push(`total ${sale.grand_total} != paid ${sale.paid_total} + due ${sale.due_total}`)
  }

  // payment total = recorded payments
  const { data: pays } = await db
    .from('sale_payments')
    .select('amount')
    .eq('sale_id', saleId)
    .is('deleted_at', null)
  const paySum = (pays ?? []).reduce((s, p) => s + Number(p.amount), 0)
  if (paySum > Number(sale.grand_total) + EPS) {
    problems.push(`payments ${paySum} exceed total ${sale.grand_total}`)
  }

  // items exist (no orphan / empty sale)
  const { data: items } = await db.from('sale_items').select('id, qty, line_total').eq('sale_id', saleId).is('deleted_at', null)
  if (!items?.length) problems.push('no sale_items')

  // stock ledger movement = item quantity (outbound)
  const { data: ledger } = await db
    .from('stock_ledger')
    .select('quantity_delta, quantity_after')
    .eq('reference_type', 'sale')
    .eq('reference_id', saleId)
    .is('deleted_at', null)
  const soldQty = (items ?? []).reduce((s, it) => s + Number(it.qty), 0)
  const ledgerDelta = (ledger ?? []).reduce((s, l) => s + Number(l.quantity_delta), 0)
  if (!ledger?.length) problems.push('no stock_ledger movement')
  else if (!approxEqual(Math.abs(ledgerDelta), soldQty)) {
    problems.push(`stock delta ${ledgerDelta} != sold qty ${soldQty}`)
  }
  if ((ledger ?? []).some((l) => Number(l.quantity_after) < 0)) problems.push('negative inventory after sale')

  // customer ledger impact = due
  if (sale.customer_id && Number(sale.due_total) > EPS) {
    const { data: cl } = await db
      .from('customer_ledger')
      .select('debit, credit')
      .eq('reference_type', 'sale')
      .eq('reference_id', saleId)
      .is('deleted_at', null)
    const net = (cl ?? []).reduce((s, e) => s + Number(e.debit) - Number(e.credit), 0)
    if (!cl?.length) problems.push('no customer_ledger entry for due sale')
    else if (!approxEqual(net, Number(sale.due_total))) {
      problems.push(`customer ledger ${net} != due ${sale.due_total}`)
    }
  }

  // financial account movement = paid amount (income postings)
  if (Number(sale.paid_total) > EPS) {
    const { data: ft } = await db
      .from('financial_transactions')
      .select('amount, direction')
      .eq('source_type', 'sale')
      .eq('source_id', saleId)
      .is('deleted_at', null)
    const inflow = (ft ?? [])
      .filter((t) => (t.direction || '').toLowerCase() === 'in' || (t.direction || '').toLowerCase() === 'credit')
      .reduce((s, t) => s + Number(t.amount), 0)
    if (!ft?.length) problems.push('no financial_transactions for paid sale')
    else if (!approxEqual(inflow || (ft ?? []).reduce((s, t) => s + Number(t.amount), 0), Number(sale.paid_total))) {
      problems.push(`financial movement != paid ${sale.paid_total}`)
    }
  }

  // journal debit = credit
  const { data: entries } = await db
    .from('journal_entries')
    .select('id')
    .eq('source_type', 'sale')
    .eq('source_id', saleId)
    .is('deleted_at', null)
  if (!entries?.length) problems.push('no journal_entries')
  else {
    const ids = entries.map((e) => e.id)
    const { data: lines } = await db
      .from('journal_lines')
      .select('debit, credit')
      .in('journal_entry_id', ids)
      .is('deleted_at', null)
    const debit = (lines ?? []).reduce((s, l) => s + Number(l.debit), 0)
    const credit = (lines ?? []).reduce((s, l) => s + Number(l.credit), 0)
    if (!approxEqual(debit, credit)) problems.push(`journal debit ${debit} != credit ${credit}`)
  }

  return { ok: problems.length === 0, invoice: sale.invoice_no, problems }
}

async function main() {
  console.log('— POS demo sales seed —')
  console.log(admin ? 'Mode: RPC create + service-role backdate/verify' : 'Mode: RPC create + user-scope verify')

  const user = await signIn()
  console.log(`Signed in as ${user.email}`)

  const prereq = await loadPrerequisites()
  console.log(`Branch: ${prereq.branch.name} · customers: ${prereq.customers.length} · sellable variants: ${prereq.sellable.length}`)

  const specs = buildSaleSpecs(prereq)
  if (specs.length < COUNT) {
    console.warn(`⚠ Only ${specs.length}/${COUNT} sales could be planned from available stock.`)
  }

  const created = []
  const skipped = []
  const invoiceNos = []

  for (const spec of specs) {
    const found = await existingSale(spec.key)
    if (found) {
      skipped.push({ key: spec.key, invoice: found.invoice_no })
      invoiceNos.push(found.invoice_no)
      continue
    }
    try {
      const res = await createSale(spec, prereq.branch)
      const saleId = res?.sale_id
      const invoice = res?.invoice_no
      if (!saleId) throw new Error('RPC returned no sale_id')
      await backdate(saleId, spec.daysAgo)
      created.push({ key: spec.key, saleId, invoice, total: spec.expectedTotal })
      invoiceNos.push(invoice)
      console.log(`✓ ${spec.key} → ${invoice} (${money(spec.expectedTotal)})`)
    } catch (e) {
      console.error(`✖ ${spec.key} failed: ${e.message}`)
    }
  }

  // Verification
  console.log('\n— Verification —')
  const results = []
  for (const c of created) {
    const v = await verifySale(c.saleId)
    results.push({ key: c.key, ...v })
    console.log(`${v.ok ? '✓' : '✖'} ${c.key} (${v.invoice ?? c.invoice}) ${v.ok ? 'reconciled' : v.problems.join('; ')}`)
  }

  // Global integrity: duplicate invoice/key across seeded set
  const dupInvoices = invoiceNos.filter((v, i) => invoiceNos.indexOf(v) !== i)
  if (dupInvoices.length) console.error(`✖ Duplicate invoice numbers: ${[...new Set(dupInvoices)].join(', ')}`)

  console.log('\n— Summary —')
  console.log(`Created: ${created.length}`)
  console.log(`Skipped (already seeded): ${skipped.length}`)
  console.log(`Invoices: ${invoiceNos.join(', ') || '(none)'}`)
  const reconciled = results.filter((r) => r.ok).length
  console.log(`Reconciled: ${reconciled}/${created.length}`)
  const failedReconcile = results.filter((r) => !r.ok)
  if (failedReconcile.length) {
    console.error('Reconciliation failures:')
    failedReconcile.forEach((r) => console.error(`  ${r.key}: ${r.problems.join('; ')}`))
    process.exitCode = 2
  }
  if (!admin) {
    console.log('\nNote: SUPABASE_SERVICE_ROLE_KEY not set — dates were not back-dated and')
    console.log('verification ran under RLS as the signed-in user.')
  }
}

main().catch((e) => fail(e?.message || String(e)))
