import { supabase } from '@/lib/supabase/client'
import type { Json } from '@/types/database'

export type PurchaseLineInput = {
  variant_id: string
  qty: number
  unit_cost: number
  line_discount?: number
}

export type PurchasePaymentInput = {
  method: string
  amount: number
  financial_account_id?: string | null
  reference?: string | null
}

export type CompletePurchasePayload = {
  branch_id: string
  supplier_id: string
  client_txn_key: string
  invoice_no?: string
  discount?: number
  tax?: number
  shipping?: number
  note?: string
  items: PurchaseLineInput[]
  payments?: PurchasePaymentInput[]
}

export type PaySupplierPayload = {
  supplier_id: string
  branch_id?: string | null
  purchase_id?: string | null
  amount: number
  method?: string
  financial_account_id?: string | null
  reference?: string | null
  client_txn_key?: string
}

async function searchSuppliers(query: string) {
  const q = query.trim()
  let builder = supabase
    .from('suppliers')
    .select('id, name, phone, current_due')
    .is('deleted_at', null)
    .neq('status', 'inactive')
    .order('name', { ascending: true })
    .limit(20)
  if (q) builder = builder.or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
  const { data, error } = await builder
  if (error) throw error
  return (data ?? []).map((s) => ({
    id: s.id,
    label: s.name,
    description: s.phone ? `${s.phone} · due ৳${Number(s.current_due).toFixed(0)}` : `due ৳${Number(s.current_due).toFixed(0)}`,
  }))
}

async function searchVariants(query: string) {
  const q = query.trim()
  let builder = supabase
    .from('product_variants')
    .select('id, sku, name, barcode, purchase_price, products!inner(name)')
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('sku', { ascending: true })
    .limit(20)
  if (q) builder = builder.or(`sku.ilike.%${q}%,barcode.ilike.%${q}%,name.ilike.%${q}%`)
  const { data, error } = await builder
  if (error) throw error
  return (data ?? []).map((v) => {
    const product = v.products as unknown as { name: string }
    return {
      id: v.id,
      label: `${product.name} · ${v.name || v.sku}`,
      description: `SKU ${v.sku} · cost ৳${Number(v.purchase_price).toFixed(2)}`,
      unitCost: Number(v.purchase_price),
    }
  })
}

async function completePurchase(payload: CompletePurchasePayload) {
  const { data, error } = await supabase.rpc('complete_purchase', {
    payload: payload as unknown as Json,
  })
  if (error) throw error
  return data as { purchase_id: string; invoice_no: string; grand_total: number }
}

async function listPurchases(limit = 100) {
  const { data, error } = await supabase
    .from('purchases')
    .select(
      'id, invoice_no, status, payment_status, grand_total, paid_total, due_total, completed_at, created_at, supplier_id, suppliers(name)',
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

async function getPurchase(id: string) {
  const { data, error } = await supabase
    .from('purchases')
    .select(
      `
      *,
      suppliers(name, phone, address),
      purchase_items(*, product_variants(sku, name, products(name))),
      purchase_payments(*)
    `,
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  return data
}

async function listPurchaseReturns(limit = 100) {
  const { data, error } = await supabase
    .from('purchase_returns')
    .select(
      'id, return_no, status, total, reason, created_at, supplier_id, purchase_id, suppliers(name)',
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

async function getPurchaseReturn(id: string) {
  const { data, error } = await supabase
    .from('purchase_returns')
    .select(
      `
      id, return_no, status, total, reason, created_at, supplier_id, purchase_id, branch_id,
      suppliers(name),
      purchase_return_items(
        id, purchase_item_id, variant_id, qty, unit_cost, line_total,
        product_variants(sku, name, products(name))
      )
    `,
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  return data
}

async function createPurchaseReturn(input: {
  organization_id: string
  branch_id: string
  purchase_id: string
  supplier_id: string
  reason?: string
  items: Array<{ variant_id: string; qty: number; unit_cost: number; purchase_item_id?: string }>
  refund_account_id?: string
}) {
  const clientTxnKey =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `pr-${Date.now()}`
  const { data, error } = await supabase.rpc('approve_purchase_return', {
    payload: {
      purchase_id: input.purchase_id,
      client_txn_key: clientTxnKey,
      reason: input.reason ?? null,
      refund_account_id: input.refund_account_id ?? null,
      items: input.items.map((i) => ({
        purchase_item_id: i.purchase_item_id,
        variant_id: i.variant_id,
        qty: i.qty,
      })),
    } as unknown as Json,
  })
  if (error) throw error
  return data
}

async function voidPurchaseReturn(returnId: string, reason: string) {
  const { data, error } = await supabase.rpc('void_purchase_return', {
    return_id: returnId,
    reason,
  })
  if (error) throw error
  return data as {
    purchase_return_id: string
    status: string
    due_restored?: number
    cash_voided?: number
    reversing_journal_id?: string | null
    idempotent?: boolean
  }
}

async function paySupplier(payload: PaySupplierPayload) {
  if (!payload.branch_id) throw new Error('Select an active branch first')
  if (!payload.financial_account_id) throw new Error('Select a payment account')
  const clientTxnKey =
    payload.client_txn_key ??
    (typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `spay-${Date.now()}`)
  const { data, error } = await supabase.rpc('pay_supplier', {
    payload: {
      supplier_id: payload.supplier_id,
      branch_id: payload.branch_id,
      purchase_id: payload.purchase_id ?? null,
      amount: payload.amount,
      note: null,
      client_txn_key: clientTxnKey,
      payments: [
        {
          method: payload.method ?? 'cash',
          amount: payload.amount,
          financial_account_id: payload.financial_account_id,
          reference: payload.reference ?? null,
        },
      ],
    } as unknown as Json,
  })
  if (error) throw error
  return data
}

async function listSupplierPayments(limit = 100) {
  // Party-level pay_supplier posts supplier_ledger (not always purchase_payments).
  const { data, error } = await supabase
    .from('supplier_ledger')
    .select(
      'id, supplier_id, credit, debit, entry_type, notes, occurred_at, reference_id, reference_type, suppliers(name)',
    )
    .in('entry_type', ['supplier_payment', 'purchase_payment', 'payment'])
    .gt('credit', 0)
    .is('deleted_at', null)
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id,
    amount: Number(row.credit ?? 0),
    method: row.entry_type,
    reference: row.notes,
    created_at: row.occurred_at,
    purchase_id: row.reference_type === 'purchase' ? row.reference_id : null,
    purchases: {
      invoice_no: row.reference_id,
      supplier_id: row.supplier_id,
      suppliers: (row as { suppliers?: { name?: string } | null }).suppliers ?? null,
    },
  }))
}

async function listFinancialAccounts() {
  const { data, error } = await supabase
    .from('financial_accounts')
    .select('id, name, account_kind, current_balance')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name')
  if (error) throw error
  return data ?? []
}

export const purchasesRepository = {
  searchSuppliers,
  searchVariants,
  completePurchase,
  listPurchases,
  getPurchase,
  listPurchaseReturns,
  getPurchaseReturn,
  createPurchaseReturn,
  voidPurchaseReturn,
  paySupplier,
  listSupplierPayments,
  listFinancialAccounts,
}
