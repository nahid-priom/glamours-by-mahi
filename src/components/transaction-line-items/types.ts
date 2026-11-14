export type TransactionLineItemView = {
  id: string
  productName: string
  metadata?: string
  productId?: string
  imageUrl?: string | null
  qty: number
  unitPrice: number
  /** When set and > 0, shown in Discount column / card. */
  lineDiscount?: number | null
  lineTotal: number
}

export type TransactionLineItemsLabels = {
  unitPrice?: string
  discount?: string
  empty?: string
  countSingular?: string
  countPlural?: string
}
