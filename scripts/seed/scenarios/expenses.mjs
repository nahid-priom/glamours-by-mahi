import { txnKey } from '../_lib/constants.mjs'
import { client } from '../_lib/clients.mjs'
import { daysAgo, toDay } from '../_lib/dates.mjs'
import { backdateExpense } from '../_lib/backdate.mjs'
import { existsExpense } from '../_lib/idempotency.mjs'

async function pickFundedAccount(ctx, amount) {
  const methods = [ctx.payment.bank, ctx.payment.bkash, ctx.payment.cash]
  for (const m of methods) {
    const id = ctx.payment.accountFor(m)
    const { data } = await client
      .from('financial_accounts')
      .select('current_balance, name')
      .eq('id', id)
      .maybeSingle()
    if (Number(data?.current_balance ?? 0) >= amount) return id
  }
  return null
}

const EXPENSE_TEMPLATES = [
  { cat: 'Shop Rent', amount: 12000, payee: 'Landlord' },
  { cat: 'Electricity', amount: 3500, payee: 'DESCO' },
  { cat: 'Internet', amount: 1800, payee: 'Link3' },
  { cat: 'Staff Refreshments', amount: 900, payee: 'Local Cafe' },
  { cat: 'Delivery', amount: 1500, payee: 'Courier' },
  { cat: 'Packaging', amount: 1200, payee: 'Supply House' },
  { cat: 'Local Transport', amount: 600, payee: 'CNG' },
  { cat: 'Repair & Maintenance', amount: 2200, payee: 'Technician' },
  { cat: 'Marketing', amount: 2500, payee: 'Facebook Ads' },
  { cat: 'Office Supplies', amount: 800, payee: 'Stationery' },
  { cat: 'Cleaning', amount: 1000, payee: 'Cleaning Service' },
  { cat: 'Mobile Bill', amount: 1200, payee: 'Grameenphone' },
]

export async function runExpenses(ctx) {
  if (!ctx.expenseCategories?.length) {
    await import('./reference.mjs').then((m) => m.ensureExpenseCategories(ctx))
  }

  const catByName = new Map(ctx.expenseCategories.map((c) => [c.name.toLowerCase(), c]))
  let created = 0
  let skipped = 0
  let seq = 1

  for (let i = 0; i < 24; i++) {
    const tpl = EXPENSE_TEMPLATES[i % EXPENSE_TEMPLATES.length]
    const branch = ctx.selected[i % ctx.selected.length]
    const key = txnKey('EXP', new Date().getFullYear(), String(seq).padStart(4, '0'))
    const ref = `DEMO-EXP-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`
    seq += 1

    if (await existsExpense(ctx.org.id, key)) {
      skipped += 1
      continue
    }

    const category = catByName.get(tpl.cat.toLowerCase())
    if (!category) continue

    const amount = Math.min(tpl.amount + (i % 4) * 50, 2500)
    const account = await pickFundedAccount(ctx, amount)
    if (!account) {
      ctx.stats.errors.push(`expense ${key}: no funded account for ৳${amount}`)
      continue
    }

    const when = daysAgo(80 - i * 2)

    try {
      const { data, error } = await client.rpc('create_expense', {
        payload: {
          amount,
          account_id: account,
          category_id: category.id,
          branch_id: branch.id,
          note: `legacy_multibranch_demo_v1 · ${tpl.cat} · ${branch.code}`,
          entry_date: toDay(when),
          reference: ref,
          payee: tpl.payee,
          client_txn_key: key,
        },
      })
      if (error) throw new Error(error.message)
      const expenseId = data?.expense_id ?? data?.id
      if (expenseId) await backdateExpense(expenseId, when)
      created += 1
    } catch (e) {
      ctx.stats.errors.push(`expense ${key}: ${e.message}`)
    }
  }

  ctx.stats.created.expenses = created
  ctx.stats.skipped.expenses = skipped
  console.log(`Expenses: ${created} created, ${skipped} skipped`)
}
