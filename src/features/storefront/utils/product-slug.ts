export function safeProductName(name?: string | null): string {
  if (!name) return 'Premium Fashion Item'
  const trimmed = name.trim()
  if (!trimmed || /^undefined(\s+undefined)?$/i.test(trimmed)) {
    return 'Premium Fashion Item'
  }
  return trimmed
}

export function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function createProductSlug(name: string, sku: string): string {
  return normalizeSlug(`${safeProductName(name)}-${sku || 'item'}`)
}

export function matchesProductSlug(productSlug: string, targetSlug: string): boolean {
  return normalizeSlug(productSlug) === normalizeSlug(targetSlug)
}
