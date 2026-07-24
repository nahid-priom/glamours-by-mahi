import { txnKey, demoRef, round2 } from '../_lib/constants.mjs'
import { client } from '../_lib/clients.mjs'
import { daysAgo, currentYear } from '../_lib/dates.mjs'
import { backdatePurchase } from '../_lib/backdate.mjs'
import { findByClientTxnKey } from '../_lib/resolve.mjs'

function pickVariants(catalog, count, offset = 0) {
  const priced = catalog.filter((v) => v.cost > 0)
  const items = []
  for (let i = 0; i < count; i++) {
    const v = priced[(offset + i) % priced.length]
    if (!v) break
    items.push({
      variant_id: v.id,
      qty: 5 + (i % 8),
      unit_cost: v.cost > 0 ? v.cost : 250 + i * 10,
      line_discount: 0,
    })
  }
  return items
}

/**
 * Purchases via complete_purchase (atomic receive + supplier due + optional payment).
 */
export async function runPurchases(ctx) {
  if (!ctx.suppliers?.length) throw new Error('Run reference seed first.')
  const year = currentYear()
  const specs = []
  let seq = 1

  // HQ opening stock purchases (credit)
  for (let i = 0; i < 4; i++) {
    specs.push({
      key: txnKey('PO', year, String(seq).padStart(4, '0')),
      ref: demoRef('PO', 'HQ', seq++, year),
      branch: ctx.main,
      supplier: ctx.suppliers[i % ctx.suppliers.length],
      daysAgo: 150 - i * 10,
      items: pickVariants(ctx.catalog, 2 + (i % 3), i * 2),
      payments: [],
    })
  }

  // Branch-direct purchases with partial/full payment
  for (const branch of ctx.additional.slice(0, 3)) {
    specs.push({
      key: txnKey('PO', year, String(seq).padStart(4, '0')),
      ref: demoRef('PO', branch.code, seq++, year),
      branch,
      supplier: ctx.suppliers[seq % ctx.suppliers.length],
      daysAgo: 90 - seq,
      items: pickVariants(ctx.catalog, 2, seq),
      payments: [],
    })
    specs.push({
      key: txnKey('PO', year, String(seq).padStart(4, '0')),
      ref: demoRef('PO', branch.code, seq++, year),
      branch,
      supplier: ctx.suppliers[(seq + 1) % ctx.suppliers.length],
      daysAgo: 60 - seq,
      items: pickVariants(ctx.catalog, 1, seq + 3),
      paymentType: 'cash',
    })
  }

  // Recent HQ purchases: split payment + full paid
  specs.push({
    key: txnKey('PO', year, String(seq).padStart(4, '0')),
    ref: demoRef('PO', 'HQ', seq++, year),
    branch: ctx.main,
    supplier: ctx.suppliers[0],
    daysAgo: 25,
    items: pickVariants(ctx.catalog, 3, 5),
    paymentType: 'partial',
  })
  specs.push({
    key: txnKey('PO', year, String(seq).padStart(4, '0')),
    ref: demoRef('PO', 'HQ', seq++, year),
    branch: ctx.main,
    supplier: ctx.suppliers[1],
    daysAgo: 12,
    items: pickVariants(ctx.catalog, 2, 8),
    paymentType: 'full',
  })

  const created = []
  const skipped = []

  for (const spec of specs) {
    const found = await findByClientTxnKey('purchases', ctx.org.id, spec.key)
    if (found) {
      skipped.push(spec.key)
      ctx.purchaseByKey = ctx.purchaseByKey ?? new Map()
      ctx.purchaseByKey.set(spec.key, found)
      continue
    }

    const gross = spec.items.reduce((s, it) => s + it.unit_cost * it.qty, 0)
    const total = round2(gross)
    let payments = []

    if (spec.paymentType === 'full') {
      payments = [
        {
          method: ctx.payment.cash.code,
          amount: total,
          financial_account_id: ctx.payment.accountFor(ctx.payment.cash),
        },
      ]
    } else if (spec.paymentType === 'partial') {
      const paid = round2(total * 0.4)
      payments = [
        {
          method: ctx.payment.bank.code,
          amount: paid,
          financial_account_id: ctx.payment.accountFor(ctx.payment.bank),
        },
      ]
    } else if (spec.paymentType === 'cash') {
      payments = [
        {
          method: ctx.payment.cash.code,
          amount: total,
          financial_account_id: ctx.payment.accountFor(ctx.payment.cash),
        },
      ]
    }

    try {
      const { data, error } = await client.rpc('complete_purchase', {
        payload: {
          branch_id: spec.branch.id,
          supplier_id: spec.supplier.id,
          client_txn_key: spec.key,
          invoice_no: spec.ref,
          note: `${spec.ref} · ${spec.key}`,
          items: spec.items,
          payments,
        },
      })
      if (error) throw new Error(error.message)
      const purchaseId = data?.purchase_id
      if (purchaseId) await backdatePurchase(purchaseId, daysAgo(spec.daysAgo))
      created.push({ key: spec.key, purchaseId, ref: spec.ref })
      ctx.purchaseByKey = ctx.purchaseByKey ?? new Map()
      ctx.purchaseByKey.set(spec.key, { id: purchaseId, invoice_no: spec.ref })
      console.log(`  ✓ ${spec.ref} (${spec.branch.code})`)
    } catch (e) {
      ctx.stats.errors.push(`purchase ${spec.key}: ${e.message}`)
      console.error(`  ✖ ${spec.ref}: ${e.message}`)
    }
  }

  ctx.stats.created.purchases = created.length
  ctx.stats.skipped.purchases = skipped.length
  console.log(`Purchases: ${created.length} created, ${skipped.length} skipped`)
  return created
}
