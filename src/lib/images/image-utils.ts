/** Shared product placeholder — fashion-neutral brand asset */
export const PRODUCT_PLACEHOLDER = '/images/product-placeholder.svg'

export function isValidImageSource(src: unknown): src is string {
  if (typeof src !== 'string') return false
  const value = src.trim()
  if (!value || value === 'undefined' || value === 'null') return false
  if (value.startsWith('data:') || value.startsWith('blob:')) return true
  if (value.startsWith('/')) return true
  if (value.startsWith('./') || value.startsWith('../')) return true
  try {
    const url = new URL(value, typeof window !== 'undefined' ? window.location.origin : 'https://local')
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function normalizeImageUrl(src: unknown, fallback = PRODUCT_PLACEHOLDER): string {
  if (!isValidImageSource(src)) return fallback
  const value = src.trim()
  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:') || value.startsWith('blob:')) {
    return value
  }
  if (value.startsWith('/')) return value
  return `/${value.replace(/^\.?\//, '')}`
}

export function getFallbackImage(): string {
  return PRODUCT_PLACEHOLDER
}

export function deduplicateImageUrls(urls: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of urls) {
    if (!isValidImageSource(raw)) continue
    const url = normalizeImageUrl(raw)
    if (seen.has(url)) continue
    seen.add(url)
    result.push(url)
  }
  return result
}
