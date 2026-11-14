import type { SaleDetail } from '../../repositories/sales.repository'

export type SaleDetailLineItem = NonNullable<SaleDetail['sale_items']>[number]

export type SaleItemViewModel = {
  id: string
  productId: string
  productName: string
  imageUrl: string | null | undefined
  metadata: string
  qty: number
  unitPrice: number
  lineTotal: number
}
