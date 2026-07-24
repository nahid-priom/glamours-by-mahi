export type CartPayment = {
  method: string
  amount: number
  financialAccountId?: string
  reference?: string
}

export type CartLine = {
  variantId: string
  productId: string
  productName: string
  variantLabel: string
  sku: string
  barcode: string
  thumbnailUrl?: string
  unitPrice: number
  qty: number
  lineDiscount: number
  availableStock: number
}

export type CartState = {
  lines: CartLine[]
  customerId: string | null
  customerLabel: string | null
  invoiceDiscount: number
  tax: number
  shipping: number
  payments: CartPayment[]
  note: string
}

export type HeldSalePayload = {
  id?: string
  holdLabel?: string | null
  branchId: string
  customerId: string | null
  customerLabel: string | null
  note: string
  invoiceDiscount: number
  tax: number
  shipping: number
  lines: CartLine[]
  payments: CartPayment[]
}

export type PosVariant = {
  variantId: string
  productId: string
  productName: string
  variantLabel: string
  sku: string
  barcode: string | null
  thumbnailUrl?: string | null
  unitPrice: number
  availableStock: number
}

export type CartTotals = {
  subtotal: number
  tax: number
  shipping: number
  discount: number
  grandTotal: number
  paid: number
  due: number
  change: number
}

export type CompletePosSalePayload = {
  branch_id: string
  customer_id: string | null
  salesperson_employee_id?: string | null
  client_txn_key: string
  note: string | null
  discount: number
  tax: number
  shipping: number
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
