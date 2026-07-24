import { txnKey, NS } from '../_lib/constants.mjs'
import { client } from '../_lib/clients.mjs'
import { currentYear } from '../_lib/dates.mjs'

export async function runReturns(ctx) {
  const year = currentYear()
  let created = 0
  let skipped = 0

  // Sales return: partial on a paid sale
  const { data: paidSales } = await client
    .from('sales')
    .select('id, invoice_no, paid_total, client_txn_key')
    .eq('organization_id', ctx.org.id)
    .like('client_txn_key', `${NS}::SALE::%`)
    .gt('paid_total', 100)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(5)

  if (paidSales?.length) {
    const sale = paidSales[0]
    const retKey = txnKey('SRET', year, '0001')
    const { data: existing } = await client
      .from('sale_returns')
      .select('id')
      .eq('sale_id', sale.id)
      .is('deleted_at', null)
      .maybeSingle()

    if (!existing) {
      const { data: saleItems } = await client
        .from('sale_items')
        .select('id, qty')
        .eq('sale_id', sale.id)
        .is('deleted_at', null)
        .limit(1)

      if (saleItems?.length) {
        const item = saleItems[0]
        const qty = Math.max(1, Math.floor(Number(item.qty) / 2))
        try {
          const { error } = await client.rpc('approve_sales_return', {
            payload: {
              sale_id: sale.id,
              client_txn_key: retKey,
              reason: 'Demo partial return — size exchange',
              refund_account_id: ctx.payment.accountFor(ctx.payment.cash),
              items: [{ sale_item_id: item.id, qty, condition: 'sellable' }],
            },
          })
          if (error) throw new Error(error.message)
          created += 1
          console.log(`  ✓ Sales return (partial) on ${sale.invoice_no}`)
        } catch (e) {
          ctx.stats.errors.push(`sales return: ${e.message}`)
        }
      }
    } else skipped += 1
  }

  // Purchase return on a credit purchase
  const { data: purchases } = await client
    .from('purchases')
    .select('id, invoice_no, client_txn_key')
    .eq('organization_id', ctx.org.id)
    .like('client_txn_key', `${NS}::PO::%`)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(3)

  if (purchases?.length) {
    const po = purchases[0]
    const prKey = txnKey('PRET', year, '0001')
    const { data: existingPr } = await client
      .from('purchase_returns')
      .select('id')
      .eq('purchase_id', po.id)
      .is('deleted_at', null)
      .maybeSingle()

    if (!existingPr) {
      const { data: pi } = await client
        .from('purchase_items')
        .select('id, qty')
        .eq('purchase_id', po.id)
        .is('deleted_at', null)
        .limit(1)
      if (pi?.length) {
        const line = pi[0]
        const qty = Math.max(1, Math.floor(Number(line.qty) / 3))
        try {
          const { error } = await client.rpc('approve_purchase_return', {
            payload: {
              purchase_id: po.id,
              client_txn_key: prKey,
              refund_account_id: ctx.payment.accountFor(ctx.payment.bank),
              items: [{ purchase_item_id: line.id, qty }],
            },
          })
          if (error) throw new Error(error.message)
          created += 1
          console.log(`  ✓ Purchase return on ${po.invoice_no}`)
        } catch (e) {
          ctx.stats.errors.push(`purchase return: ${e.message}`)
        }
      }
    } else skipped += 1
  }

  ctx.stats.created.returns = created
  ctx.stats.skipped.returns = skipped
  console.log(`Returns: ${created} created, ${skipped} skipped`)
}
