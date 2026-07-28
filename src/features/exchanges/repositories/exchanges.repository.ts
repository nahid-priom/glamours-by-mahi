import { supabase } from '@/lib/supabase/client'

type UntypedRpc = (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>

const untypedRpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc
// Tables not yet in generated Database types
const untypedFrom = ((table: string) => (supabase as any).from(table)) as (table: string) => any

export type ExchangeRow = {
  id: string
  exchange_no: string
  status: string
  difference_amount: number
  sale_id: string
  branch_id: string
  note: string | null
  created_at: string
  sales?: { invoice_no: string; customer_id: string | null } | null
  branches?: { name: string } | null
}

export type ExchangeSaleSearchRow = {
  id: string
  invoice_no: string
  grand_total: number
  status: string
  created_at: string
  customer_id: string | null
  customers?: { id: string; name: string; phone: string | null } | null
}

export type ExchangeSaleItemRow = {
  id: string
  variant_id: string
  qty: number
  unit_price: number
  line_discount: number
  line_total: number
  already_returned: number
  already_exchanged: number
  returnable_qty: number
  product_variants?: {
    sku: string
    name: string | null
    selling_price: number
    products?: { name: string } | null
  } | null
}

export type CompleteExchangePayload = {
  sale_id: string
  client_txn_key: string
  note?: string | null
  payment_account_id?: string | null
  refund_account_id?: string | null
  charge_as_due?: boolean
  credit_as_advance?: boolean
  return_items: Array<{
    sale_item_id: string
    variant_id?: string
    qty: number
    condition?: string
  }>
  replacement_items: Array<{
    variant_id: string
    qty: number
    unit_price: number
  }>
}

export type CompleteExchangeResult = {
  exchange_id: string
  exchange_no: string
  difference: number
  return_total?: number
  replacement_total?: number
  idempotent?: boolean
}

function range(page: number, pageSize: number) {
  const from = (page - 1) * pageSize
  return { from, to: from + pageSize - 1 }
}

export async function listExchanges(
  filters: { page?: number; pageSize?: number; status?: string; search?: string } = {},
): Promise<{ items: ExchangeRow[]; total: number }> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 30
  const { from, to } = range(page, pageSize)

  let q = untypedFrom('exchanges')
    .select('*, sales(invoice_no, customer_id), branches(name)', { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters.status) {
    q = q.eq('status', filters.status)
  }
  if (filters.search?.trim()) {
    const s = filters.search.trim()
    q = q.ilike('exchange_no', `%${s}%`)
  }

  const { data, error, count } = await q
  if (error) throw error
  return {
    items: ((data ?? []) as ExchangeRow[]).map((row) => ({
      ...row,
      difference_amount: Number(row.difference_amount ?? 0),
    })),
    total: count ?? 0,
  }
}

export async function searchSalesForExchange(query: string): Promise<ExchangeSaleSearchRow[]> {
  const q = query.trim()
  let builder = supabase
    .from('sales')
    .select('id, invoice_no, grand_total, status, created_at, customer_id, customers(id, name, phone)')
    .eq('status', 'completed')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(20)

  if (q) {
    builder = builder.ilike('invoice_no', `%${q}%`)
  }

  const { data, error } = await builder
  if (error) throw error
  return ((data ?? []) as unknown as ExchangeSaleSearchRow[]).map((row) => ({
    ...row,
    grand_total: Number(row.grand_total ?? 0),
  }))
}

export async function getSaleItemsForExchange(saleId: string): Promise<ExchangeSaleItemRow[]> {
  const { data: items, error } = await supabase
    .from('sale_items')
    .select(
      `
      id,
      variant_id,
      qty,
      unit_price,
      line_discount,
      line_total,
      product_variants(
        sku,
        name,
        selling_price,
        products(name)
      )
    `,
    )
    .eq('sale_id', saleId)
    .is('deleted_at', null)

  if (error) throw error

  const saleItems = (items ?? []) as unknown as Array<{
    id: string
    variant_id: string
    qty: number
    unit_price: number
    line_discount: number
    line_total: number
    product_variants?: ExchangeSaleItemRow['product_variants']
  }>

  if (saleItems.length === 0) return []

  const saleItemIds = saleItems.map((i) => i.id)

  const [{ data: returns }, { data: exchanges }] = await Promise.all([
    supabase
      .from('sale_return_items')
      .select('sale_item_id, qty, sale_returns!inner(status, deleted_at)')
      .in('sale_item_id', saleItemIds)
      .is('deleted_at', null),
    untypedFrom('exchange_items')
      .select('original_sale_item_id, qty, direction, exchanges!inner(status, deleted_at)')
      .in('original_sale_item_id', saleItemIds)
      .eq('direction', 'return')
      .is('deleted_at', null),
  ])

  const returnedMap = new Map<string, number>()
  for (const row of (returns ?? []) as Array<{
    sale_item_id: string | null
    qty: number
    sale_returns?: { status: string; deleted_at: string | null } | null
  }>) {
    if (!row.sale_item_id) continue
    if (row.sale_returns?.deleted_at) continue
    if (row.sale_returns?.status !== 'completed') continue
    returnedMap.set(row.sale_item_id, (returnedMap.get(row.sale_item_id) ?? 0) + Number(row.qty))
  }

  const exchangedMap = new Map<string, number>()
  for (const row of (exchanges ?? []) as Array<{
    original_sale_item_id: string | null
    qty: number
    exchanges?: { status: string; deleted_at: string | null } | null
  }>) {
    if (!row.original_sale_item_id) continue
    if (row.exchanges?.deleted_at) continue
    if (row.exchanges?.status !== 'completed') continue
    exchangedMap.set(
      row.original_sale_item_id,
      (exchangedMap.get(row.original_sale_item_id) ?? 0) + Number(row.qty),
    )
  }

  return saleItems.map((item) => {
    const already_returned = returnedMap.get(item.id) ?? 0
    const already_exchanged = exchangedMap.get(item.id) ?? 0
    const qty = Number(item.qty)
    return {
      id: item.id,
      variant_id: item.variant_id,
      qty,
      unit_price: Number(item.unit_price),
      line_discount: Number(item.line_discount ?? 0),
      line_total: Number(item.line_total ?? 0),
      already_returned,
      already_exchanged,
      returnable_qty: Math.max(0, qty - already_returned - already_exchanged),
      product_variants: item.product_variants,
    }
  })
}

export async function searchCatalogueVariants(query: string) {
  const q = query.trim()
  let builder = supabase
    .from('product_variants')
    .select('id, sku, name, barcode, selling_price, products!inner(name)')
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('sku', { ascending: true })
    .limit(20)

  if (q) {
    builder = builder.or(`sku.ilike.%${q}%,barcode.ilike.%${q}%,name.ilike.%${q}%`)
  }

  const { data, error } = await builder
  if (error) throw error

  return (data ?? []).map((v) => {
    const product = v.products as unknown as { name: string }
    return {
      id: v.id,
      label: `${product.name} · ${v.name || v.sku}`,
      description: `SKU ${v.sku}`,
      unitPrice: Number(v.selling_price ?? 0),
    }
  })
}

export async function listFinancialAccounts() {
  const { data, error } = await supabase
    .from('financial_accounts')
    .select('id, name, account_kind, current_balance')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function completeExchange(
  payload: CompleteExchangePayload,
): Promise<CompleteExchangeResult> {
  const { data, error } = await untypedRpc('complete_product_exchange', { payload })
  if (error) throw error
  const raw = (data ?? {}) as Record<string, unknown>
  return {
    exchange_id: String(raw.exchange_id ?? ''),
    exchange_no: String(raw.exchange_no ?? ''),
    difference: Number(raw.difference ?? 0),
    return_total: raw.return_total != null ? Number(raw.return_total) : undefined,
    replacement_total:
      raw.replacement_total != null ? Number(raw.replacement_total) : undefined,
    idempotent: Boolean(raw.idempotent),
  }
}

export async function cancelExchange(payload: {
  exchange_id: string
  reason?: string | null
}) {
  const { data, error } = await untypedRpc('cancel_product_exchange', { payload })
  if (error) throw error
  return data as { exchange_id: string; exchange_no: string; status: string; idempotent?: boolean }
}

export const exchangesRepository = {
  listExchanges,
  searchSalesForExchange,
  getSaleItemsForExchange,
  searchCatalogueVariants,
  listFinancialAccounts,
  completeExchange,
  cancelExchange,
}
