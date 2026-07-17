/**
 * Stable local cover per storefront category slug, served from public/products.
 * One fixed image per category — never randomized during render, so the same
 * image appears on every refresh. Swap a file path here to change a cover.
 */
const CATEGORY_IMAGES: Record<string, string> = {
  'new-arrival': '/products/4.png',
  dress: '/products/7.png',
  'co-ord-set': '/products/89.png',
  'tops-tunic': '/products/2.png',
  kurti: '/products/3.png',
  accessories: '/products/8.png',
  'best-seller': '/products/1.png',
  sale: '/products/6 (1).png',
}

export function getCategoryFallback(slug: string): string | null {
  return CATEGORY_IMAGES[slug] ?? null
}
