import { formatBDT } from '@/lib/format'

export function formatLineQty(qty: number): string {
  return String(qty)
}

export function formatLineMoney(amount: number): string {
  return formatBDT(amount)
}

export function formatLineProductCount(
  count: number,
  singular = 'Product',
  plural = 'Products',
): string {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`
}
