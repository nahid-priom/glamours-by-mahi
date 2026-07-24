import { admin } from './clients.mjs'

/**
 * Back-date transactional rows after canonical RPC completion.
 * Requires SUPABASE_SERVICE_ROLE_KEY.
 */
export async function backdateSale(saleId, when) {
  if (!admin) return false
  const iso = when.toISOString()
  const day = iso.slice(0, 10)
  await admin.from('sales').update({ created_at: iso, completed_at: iso }).eq('id', saleId)
  await admin
    .from('stock_ledger')
    .update({ occurred_at: iso })
    .eq('reference_type', 'sale')
    .eq('reference_id', saleId)
  await admin
    .from('customer_ledger')
    .update({ occurred_at: iso })
    .eq('reference_type', 'sale')
    .eq('reference_id', saleId)
  await admin
    .from('financial_transactions')
    .update({ transaction_date: iso })
    .eq('source_type', 'sale')
    .eq('source_id', saleId)
  await admin
    .from('journal_entries')
    .update({ entry_date: day })
    .eq('source_type', 'sale')
    .eq('source_id', saleId)
  return true
}

export async function backdatePurchase(purchaseId, when) {
  if (!admin) return false
  const iso = when.toISOString()
  const day = iso.slice(0, 10)
  await admin.from('purchases').update({ created_at: iso, completed_at: iso }).eq('id', purchaseId)
  await admin
    .from('stock_ledger')
    .update({ occurred_at: iso })
    .eq('reference_type', 'purchase')
    .eq('reference_id', purchaseId)
  await admin
    .from('supplier_ledger')
    .update({ occurred_at: iso })
    .eq('reference_type', 'purchase')
    .eq('reference_id', purchaseId)
  await admin
    .from('financial_transactions')
    .update({ transaction_date: iso })
    .eq('source_type', 'purchase')
    .eq('source_id', purchaseId)
  await admin
    .from('journal_entries')
    .update({ entry_date: day })
    .eq('source_type', 'purchase')
    .eq('source_id', purchaseId)
  return true
}

export async function backdateTransfer(transferId, when) {
  if (!admin) return false
  const iso = when.toISOString()
  await admin.from('stock_transfers').update({ created_at: iso, dispatched_at: iso }).eq('id', transferId)
  await admin
    .from('stock_ledger')
    .update({ occurred_at: iso })
    .eq('reference_type', 'transfer')
    .eq('reference_id', transferId)
  return true
}

export async function backdateExpense(expenseId, when) {
  if (!admin) return false
  const iso = when.toISOString()
  const day = iso.slice(0, 10)
  await admin.from('expense_entries').update({ created_at: iso, entry_date: day }).eq('id', expenseId)
  await admin
    .from('financial_transactions')
    .update({ transaction_date: iso })
    .eq('source_type', 'expense')
    .eq('source_id', expenseId)
  await admin
    .from('journal_entries')
    .update({ entry_date: day })
    .eq('source_type', 'expense')
    .eq('source_id', expenseId)
  return true
}

export async function backdateCustomer(supplierOrCustomerId, table, when) {
  if (!admin) return false
  const iso = when.toISOString()
  await admin.from(table).update({ created_at: iso }).eq('id', supplierOrCustomerId)
  return true
}
