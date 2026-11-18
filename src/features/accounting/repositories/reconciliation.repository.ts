import { supabase } from '@/lib/supabase/client'

export type ReconciliationReport = {
  inventory_without_ledger_count: number
  inventory_without_ledger_qty: number
  customer_due_deltas: Array<{
    customer_id: string
    name: string
    customer_due: number
    open_sale_due: number
    delta: number
  }>
  supplier_due_deltas: Array<{
    supplier_id: string
    name: string
    supplier_due: number
    open_purchase_due: number
    delta: number
  }>
  financial_balance_deltas: Array<{
    account_id: string
    name: string
    current_balance: number
    last_txn_balance_after: number | null
    delta: number
  }>
  unbalanced_journals: Array<{
    journal_entry_id: string
    entry_no: string
    total_debit: number
    total_credit: number
    delta: number
  }>
  negative_stock_count: number
  active_reservations: number
  recent_batches: Array<{
    id: string
    batch_type: string
    mode: string
    status: string
    summary: Record<string, unknown>
    created_at: string
    completed_at: string | null
  }>
}

type UntypedRpc = (
  fn: string,
  args?: object,
) => Promise<{ data: unknown; error: { message: string } | null }>

const rpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc

async function getReport(): Promise<ReconciliationReport> {
  const { data, error } = await rpc('get_reconciliation_report', { payload: {} })
  if (error) throw new Error(error.message)
  return data as ReconciliationReport
}

async function dryRun(fn: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await rpc(fn, {
    payload: { mode: 'dry_run', ...extra },
  })
  if (error) throw new Error(error.message)
  return data
}

async function supplierFinancialDryRun() {
  const { data, error } = await rpc('recon_supplier_financial_dry_run', { payload: {} })
  if (error) throw new Error(error.message)
  return data
}

async function repairSupplierOpeningSign(mode: 'dry_run' | 'apply', clientTxnKey?: string) {
  const { data, error } = await rpc('repair_supplier_opening_sign', {
    payload: { mode, client_txn_key: clientTxnKey },
  })
  if (error) throw new Error(error.message)
  return data
}

async function repairSupplierPartySync(mode: 'dry_run' | 'apply', clientTxnKey?: string) {
  const { data, error } = await rpc('repair_supplier_party_sync', {
    payload: { mode, client_txn_key: clientTxnKey },
  })
  if (error) throw new Error(error.message)
  return data
}

export const reconciliationRepository = {
  getReport,
  dryRunOpeningStock: () => dryRun('recon_opening_stock_ledger'),
  dryRunOpeningParties: () => dryRun('recon_opening_party_balances'),
  dryRunFinancialBalances: () => dryRun('recon_rebuild_financial_running_balances'),
  dryRunPartialSales: () => dryRun('recon_repair_partial_sale_summaries'),
  supplierFinancialDryRun,
  repairSupplierOpeningSign,
  repairSupplierPartySync,
}
