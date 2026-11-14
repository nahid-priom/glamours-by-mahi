import { formatBDT } from '@/lib/format'
import type { SaleDetailLineItem, SaleItemViewModel } from './sale-item.types'

type LineOriginItem = SaleDetailLineItem & { line_origin?: string | null }

export function getSaleItemProductName(item: SaleDetailLineItem): string {
  return item.product_variants?.products?.name?.trim() || 'Item'
}

export function getSaleItemMetadata(item: SaleDetailLineItem): string {
  const parts: string[] = []
  const sku = item.product_variants?.sku?.trim()
  const variantName = item.product_variants?.name?.trim()
  const lineOrigin = (item as LineOriginItem).line_origin?.trim()

  if (sku) parts.push(sku)
  if (variantName) parts.push(variantName)
  if (lineOrigin) parts.push(lineOrigin)

  return parts.join(' · ')
}

export function toSaleItemViewModel(item: SaleDetailLineItem): SaleItemViewModel {
  const product = item.product_variants?.products
  return {
    id: item.id,
    productId: product?.id ?? item.variant_id,
    productName: getSaleItemProductName(item),
    imageUrl: product?.image_url,
    metadata: getSaleItemMetadata(item),
    qty: Number(item.qty),
    unitPrice: Number(item.unit_price),
    lineTotal: Number(item.line_total),
  }
}

export function formatSaleItemQty(qty: number): string {
  return String(qty)
}

export function formatSaleItemMoney(amount: number): string {
  return formatBDT(amount)
}

export function formatProductCount(count: number): string {
  return count === 1 ? '1 Product' : `${count} Products`
}
