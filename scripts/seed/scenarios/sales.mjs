import { txnKey, demoRef, round2 } from '../_lib/constants.mjs'
import { client } from '../_lib/clients.mjs'
import { daysAgo, currentYear } from '../_lib/dates.mjs'
import { backdateSale } from '../_lib/backdate.mjs'
import { findByClientTxnKey } from '../_lib/resolve.mjs'

function makeStockAllocator(branchCtx, catalog) {
  const remaining = new Map(catalog.filter((v) => v.stock > 0).map((v) => [v.id, v.stock]))
  return {
    take(variantId, want) {
      const left = remaining.get(variantId) ?? 0
      const take = Math.min(want, left)
      remaining.set(variantId, left - take)
      return take
    },
    pick(branchCatalog, maxItems, cursor) {
      const items = []
      const sellable = branchCatalog.filter((v) => (remaining.get(v.id) ?? 0) > 0 && v.price > 0)
      let guard = 0
      while (items.length < maxItems && guard < sellable.length * 3) {
        const v = sellable[(cursor + guard) % sellable.length]
        guard += 1
        const qty = this.take(v.id, 1 + (items.length % 2))
        if (qty > 0) {
          items.push({ variant_id: v.id, qty, unit_price: v.price, line_discount: 0 })
        }
      }
      return items
    },
  }
}

async function refreshBranchCatalog(ctx, branchId) {
  const bc = ctx.branchMap.get(branchId)
  const { data: balances } = await client
    .from('inventory_balances')
    .select('variant_id, quantity')
    .eq('location_id', bc.saleableLocationId)
    .is('deleted_at', null)
  const stockMap = new Map((balances ?? []).map((b) => [b.variant_id, Number(b.quantity)]))
  return ctx.catalog.map((v) => ({ ...v, stock: Math.floor(stockMap.get(v.id) ?? 0) }))
}

function buildSalePlans(ctx) {
  const year = currentYear()
  const plans = []
  let seq = 1
  const types = [
    'cash',
    'bank',
    'bkash',
    'split',
    'partial',
    'due',
    'due',
    'wholesale',
    'discount',
    'commission',
  ]

  for (const branch of ctx.selected) {
    const customers = ctx.customersByBranch?.get(branch.id) ?? ctx.customers ?? []
    for (let i = 0; i < 10; i++) {
      const type = types[i % types.length]
      const cust = type === 'cash' && i % 3 === 0 ? null : customers[i % Math.max(customers.length, 1)]
      plans.push({
        key: txnKey('SALE', branch.code, year, String(seq).padStart(4, '0')),
        ref: demoRef('INV', branch.code, seq++, year),
        branch,
        type,
        customer: cust,
        daysAgo: 75 - seq + i * 2,
        itemCount: 1 + (i % 3),
        withSalesperson: type === 'commission' || i % 4 === 0,
      })
    }
  }
  return plans
}

function buildPayments(ctx, type, total) {
  const { cash, bank, bkash, accountFor } = ctx.payment
  if (type === 'cash') {
    return [{ method: cash.code, amount: total, financial_account_id: accountFor(cash) }]
  }
  if (type === 'bank') {
    return [{ method: bank.code, amount: total, financial_account_id: accountFor(bank) }]
  }
  if (type === 'bkash') {
    return [{ method: bkash.code, amount: total, financial_account_id: accountFor(bkash) }]
  }
  if (type === 'split') {
    const half = round2(total / 2)
    return [
      { method: cash.code, amount: half, financial_account_id: accountFor(cash) },
      { method: bkash.code, amount: round2(total - half), financial_account_id: accountFor(bkash) },
    ]
  }
  if (type === 'partial') {
    return [{ method: cash.code, amount: round2(total * 0.45), financial_account_id: accountFor(cash) }]
  }
  if (type === 'wholesale') return []
  return [] // due
}

export async function runSales(ctx) {
  const plans = buildSalePlans(ctx)
  const created = []
  const skipped = []
  ctx.salesByKey = ctx.salesByKey ?? new Map()

  for (const plan of plans) {
    const found = await findByClientTxnKey('sales', ctx.org.id, plan.key)
    if (found) {
      skipped.push(plan.key)
      ctx.salesByKey.set(plan.key, found)
      continue
    }

    const branchCatalog = await refreshBranchCatalog(ctx, plan.branch.id)
    const alloc = makeStockAllocator(ctx.branchMap.get(plan.branch.id), branchCatalog)
    const items = alloc.pick(branchCatalog, plan.itemCount, plans.indexOf(plan))
    if (!items.length) continue

    let gross = items.reduce((s, it) => s + it.unit_price * it.qty - it.line_discount, 0)
    if (plan.type === 'discount') {
      const disc = round2(gross * 0.08)
      items[0].line_discount = disc
      gross -= disc
    }
    if (plan.type === 'wholesale') {
      items.forEach((it) => {
        const v = branchCatalog.find((x) => x.id === it.variant_id)
        if (v?.wholesale > 0) it.unit_price = v.wholesale
      })
      gross = items.reduce((s, it) => s + it.unit_price * it.qty - it.line_discount, 0)
    }
    const total = round2(gross)
    const payments = buildPayments(ctx, plan.type, total)

    const bc = ctx.branchMap.get(plan.branch.id)
    const salesperson =
      plan.withSalesperson && bc.employees.length
        ? bc.employees.find((e) => e.commission_eligible) ?? bc.employees[0]
        : null

    const payload = {
      branch_id: plan.branch.id,
      customer_id: plan.customer?.id ?? null,
      client_txn_key: plan.key,
      note: `${plan.ref} · ${plan.key}`,
      discount: 0,
      tax: 0,
      shipping: 0,
      items,
      payments,
    }
    if (salesperson) payload.salesperson_employee_id = salesperson.id

    try {
      const { data, error } = await client.rpc('complete_pos_sale', { payload })
      if (error) throw new Error(error.message)
      const saleId = data?.sale_id
      if (saleId) await backdateSale(saleId, daysAgo(plan.daysAgo))
      const row = { id: saleId, invoice_no: data?.invoice_no, key: plan.key, branch: plan.branch, type: plan.type }
      created.push(row)
      ctx.salesByKey.set(plan.key, row)
      if (created.length % 10 === 0) console.log(`  … ${created.length} sales created`)
    } catch (e) {
      ctx.stats.errors.push(`sale ${plan.key}: ${e.message}`)
    }
  }

  ctx.stats.created.sales = created.length
  ctx.stats.skipped.sales = skipped.length
  console.log(`Sales: ${created.length} created, ${skipped.length} skipped`)
  return created
}
