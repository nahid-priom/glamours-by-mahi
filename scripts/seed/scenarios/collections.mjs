import { txnKey, round2, NS } from '../_lib/constants.mjs'
import { client } from '../_lib/clients.mjs'
import { currentYear } from '../_lib/dates.mjs'
import { existsCollection } from '../_lib/idempotency.mjs'

export async function runCollections(ctx) {
  const year = currentYear()
  const { data: dueSales } = await client
    .from('sales')
    .select('id, invoice_no, customer_id, branch_id, due_total, client_txn_key')
    .eq('organization_id', ctx.org.id)
    .like('client_txn_key', `${NS}::SALE::%`)
    .gt('due_total', 0.01)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  const sales = dueSales ?? []
  if (!sales.length) {
    console.log('Collections: no due demo sales found')
    return []
  }

  const created = []
  const skipped = []
  let seq = 1

  for (let i = 0; i < Math.min(sales.length, 12); i++) {
    const sale = sales[i]
    const key = txnKey('COL', year, String(seq).padStart(4, '0'))
    seq += 1

    const existing = await existsCollection(ctx.org.id, key)
    if (existing) {
      skipped.push(key)
      continue
    }

    const due = Number(sale.due_total)
    const isFull = i % 3 !== 1
    const amount = isFull ? due : round2(due * 0.5)
    if (amount <= 0) continue

    const method = i % 2 === 0 ? ctx.payment.cash : ctx.payment.bkash
    try {
      const { error } = await client.rpc('collect_customer_due', {
        payload: {
          customer_id: sale.customer_id,
          branch_id: sale.branch_id,
          amount,
          note: `Demo collection against ${sale.invoice_no}`,
          client_txn_key: key,
          payments: [
            {
              method: method.code,
              amount,
              financial_account_id: ctx.payment.accountFor(method),
              reference: key,
            },
          ],
        },
      })
      if (error) throw new Error(error.message)
      created.push({ key, saleId: sale.id, amount })
      console.log(`  ✓ ${key} ৳${amount.toFixed(2)} → ${sale.invoice_no}`)
    } catch (e) {
      ctx.stats.errors.push(`collection ${key}: ${e.message}`)
    }
  }

  ctx.stats.created.collections = created.length
  ctx.stats.skipped.collections = skipped.length
  console.log(`Collections: ${created.length} created, ${skipped.length} skipped`)
  return created
}
