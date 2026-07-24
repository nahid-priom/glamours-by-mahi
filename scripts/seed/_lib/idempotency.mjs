import { createHash } from 'node:crypto'
import { NS } from './constants.mjs'
import { client } from './clients.mjs'

export function collectionReference(orgId, clientTxnKey) {
  const hash = createHash('sha256').update(`${orgId}:${clientTxnKey}`).digest('hex').slice(0, 24)
  return `COL-${hash}`
}

export function supplierPaymentEntryNo(orgId, clientTxnKey) {
  const hash = createHash('sha256').update(`${orgId}:${clientTxnKey}`).digest('hex').slice(0, 24)
  return `JE-SPAY-${hash}`
}

export async function existsCollection(orgId, clientTxnKey) {
  const ref = collectionReference(orgId, clientTxnKey)
  const { data } = await client
    .from('financial_transactions')
    .select('id')
    .eq('organization_id', orgId)
    .eq('reference', ref)
    .eq('status', 'posted')
    .is('deleted_at', null)
    .maybeSingle()
  return !!data
}

export async function existsSupplierPayment(orgId, clientTxnKey) {
  const entryNo = supplierPaymentEntryNo(orgId, clientTxnKey)
  const { data } = await client
    .from('journal_entries')
    .select('id')
    .eq('organization_id', orgId)
    .eq('entry_no', entryNo)
    .is('deleted_at', null)
    .maybeSingle()
  return !!data
}

export async function existsExpense(orgId, clientTxnKey) {
  const { data } = await client
    .from('expense_entries')
    .select('id')
    .eq('organization_id', orgId)
    .eq('reference', `CTX:${clientTxnKey}`)
    .is('deleted_at', null)
    .maybeSingle()
  return !!data
}

export function demoKeyPrefix(segment) {
  return `${NS}::${segment}::`
}
