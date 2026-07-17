/** Canonical storefront link for a category/subcategory slug filter. */
export function categoryShopUrl(slug: string): string {
  return `/shop?category=${encodeURIComponent(slug)}`
}
