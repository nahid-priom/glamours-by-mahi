import { txnKey, round2, NS } from '../_lib/constants.mjs'
import { client } from '../_lib/clients.mjs'
import { currentYear } from '../_lib/dates.mjs'
import { existsSupplierPayment } from '../_lib/idempotency.mjs'

export async function runSupplierPayments(ctx) {
  const year = currentYear()
  const { data: duePurchases } = await client
    .from('purchases')
    .select('id, invoice_no, supplier_id, branch_id, due_total, client_txn_key')
    .eq('organization_id', ctx.org.id)
    .like('client_txn_key', `${NS}::PO::%`)
    .gt('due_total', 0.01)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  const purchases = duePurchases ?? []
  if (!purchases.length) {
    console.log('Supplier payments: no due demo purchases')
    return []
  }

  const created = []
  const skipped = []
  let seq = 1

  for (let i = 0; i < Math.min(purchases.length, 8); i++) {
    const po = purchases[i]
    const key = txnKey('SPAY', year, String(seq).padStart(4, '0'))
    seq += 1

    const existing = await existsSupplierPayment(ctx.org.id, key)
    if (existing) {
      skipped.push(key)
      continue
    }

    const due = Number(po.due_total)
    const amount = i % 4 === 0 ? due : round2(due * (i % 2 === 0 ? 0.6 : 1))
    const method = i % 2 === 0 ? ctx.payment.bank : ctx.payment.cash

    try {
      const { error } = await client.rpc('pay_supplier', {
        payload: {
          supplier_id: po.supplier_id,
          branch_id: po.branch_id,
          purchase_id: po.id,
          client_txn_key: key,
          reference: key,
          payments: [
            {
              method: method.code,
              amount,
              financial_account_id: ctx.payment.accountFor(method),
            },
          ],
        },
      })
      if (error) throw new Error(error.message)
      created.push({ key, purchaseId: po.id, amount })
      console.log(`  ✓ ${key} ৳${amount.toFixed(2)} → ${po.invoice_no}`)
    } catch (e) {
      ctx.stats.errors.push(`supplier payment ${key}: ${e.message}`)
    }
  }

  ctx.stats.created.supplierPayments = created.length
  ctx.stats.skipped.supplierPayments = skipped.length
  console.log(`Supplier payments: ${created.length} created, ${skipped.length} skipped`)
  return created
}
