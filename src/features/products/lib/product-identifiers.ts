/** First two alphanumeric characters from the product name (uppercase). */
export function skuPrefixFromProductName(name: string): string {
  const letters = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  if (letters.length >= 2) return letters.slice(0, 2)
  if (letters.length === 1) return `${letters}X`
  return 'PR'
}

/** Base SKU: two-letter name prefix + 4-digit suffix. */
export function generateBaseSku(productName: string): string {
  const prefix = skuPrefixFromProductName(productName)
  const suffix = String(Math.floor(1000 + Math.random() * 9000))
  return `${prefix}${suffix}`
}

/** Random 8-digit numeric barcode. */
export function generateBaseBarcode(): string {
  return String(Math.floor(10_000_000 + Math.random() * 90_000_000))
}
