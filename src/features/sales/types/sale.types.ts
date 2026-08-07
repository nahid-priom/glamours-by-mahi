export type SalesDatePreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_7'
  | 'this_month'
  | 'last_month'
  | 'custom'
  | 'all'

export type SalesSort =
  | 'date_desc'
  | 'date_asc'
  | 'total_desc'
  | 'total_asc'
  | 'invoice_desc'
  | 'invoice_asc'

export type SaleCategoryChip = {
  name: string
  qty: number
}

export type SalesHistoryFilters = {
  search: string
  preset: SalesDatePreset
  fromDate: string | null
  toDate: string | null
  customerId: string | null
  branchId: string | null
  cashierId: string | null
  status: string | null
  paymentStatus: string | null
  paymentMethod: string | null
  categoryId: string | null
  dueOnly: boolean
  sort: SalesSort
  page: number
  pageSize: number
}

export type SalesHistoryRow = {
  id: string
  invoice_no: string
  sale_at: string
  created_at: string
  status: string
  payment_status: string
  subtotal: number
  discount: number
  grand_total: number
  paid_total: number
  due_total: number
  change_amount: number
  void_reason: string | null
  voided_at: string | null
  customer_id: string | null
  branch_id: string
  salesperson_id: string | null
  customer_name: string | null
  customer_phone: string | null
  branch_name: string | null
  cashier_name: string | null
  item_qty: number
  category_summary: SaleCategoryChip[]
  payment_methods: string | null
}

export type SalesHistoryListResult = {
  items: SalesHistoryRow[]
  total: number
  page: number
  page_size: number
}

export type SalesHistoryKpis = {
  total_sales: number
  total_paid: number
  total_due: number
  total_discount: number
  total_invoices: number
  returned_voided: number
  average_invoice: number
  total_items_sold: number
}

export type SalesColumnKey =
  | 'invoice'
  | 'customer'
  | 'items'
  | 'total'
  | 'paid'
  | 'due'
  | 'status'
  | 'actions'

export const DEFAULT_VISIBLE_COLUMNS: SalesColumnKey[] = [
  'invoice',
  'customer',
  'items',
  'total',
  'paid',
  'due',
  'status',
  'actions',
]

export const FIXED_COLUMNS: SalesColumnKey[] = ['invoice', 'total', 'status', 'actions']

export type EditSalePayload = {
  sale_id: string
  reason: string
  note?: string | null
  client_txn_key: string
  customer_id?: string | null
  discount?: number
  tax?: number
  shipping?: number
  items: Array<{
    variant_id: string
    qty: number
    unit_price: number
    line_discount: number
  }>
  payments: Array<{
    method: string
    amount: number
    financial_account_id?: string | null
    reference?: string | null
  }>
}

export type ThermalWidth = '58mm' | '80mm'
