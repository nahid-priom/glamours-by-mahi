import type { Product } from '@/types'
import { ECOMMERCE_STORE_ID } from '@/lib/constants'

export const FASHION_CATALOG_VERSION = 2
export const FASHION_CATALOG_COUNT = 120

type CatalogCategory = 'dress' | 'kurti' | 'tops-tunic' | 'co-ord-set' | 'accessories' | 'shoes' | 'bags'

interface CatalogTemplate {
  category: CatalogCategory
  prefix: string
  adjectives: string[]
  nouns: string[]
  basePrice: number
  priceRange: number
}

const TEMPLATES: CatalogTemplate[] = [
  {
    category: 'dress',
    prefix: 'DRS',
    adjectives: ['Floral', 'Silk', 'Linen', 'Embroidered', 'Block Print', 'Premium', 'Casual', 'Evening', 'Summer', 'Heritage'],
    nouns: ['Anarkali', 'Maxi Dress', 'Midi Dress', 'Wrap Dress', 'A-Line Dress', 'Shirt Dress', 'Gown', 'Sundress'],
    basePrice: 1890,
    priceRange: 4200,
  },
  {
    category: 'kurti',
    prefix: 'KRT',
    adjectives: ['Cotton', 'Embroidered', 'Printed', 'Casual', 'Festive', 'Handloom', 'Classic', 'Modern'],
    nouns: ['Kurti', 'Straight Kurti', 'Angrakha Kurti', 'A-Line Kurti', 'Long Kurti'],
    basePrice: 1290,
    priceRange: 2200,
  },
  {
    category: 'tops-tunic',
    prefix: 'TOP',
    adjectives: ['Silk', 'Ruffle', 'Linen', 'Oversized', 'Fitted', 'Casual', 'Office', 'Statement'],
    nouns: ['Tunic Top', 'Blouse', 'Crop Top', 'Peplum Top', 'Shirt Top'],
    basePrice: 990,
    priceRange: 1800,
  },
  {
    category: 'co-ord-set',
    prefix: 'CRD',
    adjectives: ['Linen', 'Cotton', 'Premium', 'Minimal', 'Resort', 'Tailored', 'Relaxed', 'Structured'],
    nouns: ['Co-ord Set', 'Two Piece Set', 'Matching Set', 'Lounge Set'],
    basePrice: 2490,
    priceRange: 3800,
  },
  {
    category: 'accessories',
    prefix: 'ACC',
    adjectives: ['Gold', 'Pearl', 'Statement', 'Minimal', 'Layered', 'Handcrafted', 'Crystal', 'Vintage'],
    nouns: ['Earrings', 'Necklace', 'Bracelet Set', 'Ring Set', 'Hair Accessory'],
    basePrice: 590,
    priceRange: 2200,
  },
  {
    category: 'shoes',
    prefix: 'SHO',
    adjectives: ['Elegant', 'Comfort', 'Classic', 'Block Heel', 'Strappy', 'Leather', 'Casual'],
    nouns: ['Heels', 'Sandals', 'Flats', 'Mules', 'Loafers'],
    basePrice: 1690,
    priceRange: 3200,
  },
  {
    category: 'bags',
    prefix: 'BAG',
    adjectives: ['Leather', 'Mini', 'Tote', 'Crossbody', 'Structured', 'Quilted', 'Everyday'],
    nouns: ['Handbag', 'Tote Bag', 'Crossbody Bag', 'Clutch', 'Shoulder Bag'],
    basePrice: 1490,
    priceRange: 5200,
  },
]

const STYLE_TAGS = ['office', 'party', 'wedding', 'casual', 'summer', 'winter'] as const
export type StyleTag = (typeof STYLE_TAGS)[number]

export interface CatalogMeta {
  category: CatalogCategory
  storefrontCategory: string
  tags: string[]
  style: StyleTag
  description: string
  isNew: boolean
  isTrending: boolean
  isFeatured: boolean
  isBestSeller: boolean
  isLimited: boolean
  onSale: boolean
  salePrice?: number
  rating: number
  reviewCount: number
}

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function pick<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)]
}

export function getCatalogMeta(sku: string, name: string, price: number, index: number): CatalogMeta {
  const rand = seededRandom(index * 997 + sku.charCodeAt(0))
  const template = TEMPLATES.find((t) => sku.startsWith(t.prefix)) ?? TEMPLATES[0]
  const style = STYLE_TAGS[index % STYLE_TAGS.length]

  const onSale = index % 9 === 0
  const salePrice = onSale ? Math.round(price * (0.75 + rand() * 0.15)) : undefined

  const tags: string[] = [template.category]
  if (index % 5 === 0) tags.push('new-arrival')
  if (index % 7 === 0) tags.push('best-seller')
  if (onSale) tags.push('sale')

  let storefrontCategory = template.category
  if (template.category === 'dress') storefrontCategory = 'dress'
  else if (template.category === 'tops-tunic') storefrontCategory = 'tops-tunic'
  else if (template.category === 'co-ord-set') storefrontCategory = 'co-ord-set'

  return {
    category: template.category,
    storefrontCategory,
    tags,
    style,
    description: `${name} — thoughtfully designed for the ${style} wardrobe. Premium fabrics, refined fit, and nationwide COD delivery.`,
    isNew: index < 24 || index % 11 === 0,
    isTrending: index % 6 === 0 || index % 13 === 0,
    isFeatured: index % 17 === 0,
    isBestSeller: index % 8 === 0,
    isLimited: index % 23 === 0,
    onSale,
    salePrice,
    rating: Math.round((4 + rand() * 0.9) * 10) / 10,
    reviewCount: Math.floor(12 + rand() * 180),
  }
}

export function generateFashionCatalog(): Product[] {
  const now = new Date().toISOString()
  const products: Product[] = []
  let index = 0

  for (const template of TEMPLATES) {
    const perCategory = Math.ceil(FASHION_CATALOG_COUNT / TEMPLATES.length)
    for (let i = 0; i < perCategory && products.length < FASHION_CATALOG_COUNT; i++) {
      const rand = seededRandom(index * 131 + i)
      const adj = pick(template.adjectives, rand)
      const noun = pick(template.nouns, rand)
      const name = `${adj} ${noun}`
      const sku = `${template.prefix}-${String(index + 1).padStart(3, '0')}`
      const price = Math.round(template.basePrice + rand() * template.priceRange)
      const stock = Math.floor(5 + rand() * 95)

      products.push({
        id: `p${index + 1}`,
        name,
        sku,
        price,
        stock,
        store_id: ECOMMERCE_STORE_ID,
        store_name: 'E-commerce Website',
        status: stock > 0 ? 'active' : 'out_of_stock',
        created_at: new Date(Date.now() - index * 86400000).toISOString(),
        updated_at: now,
      })
      index++
    }
  }

  return products
}

export { STYLE_TAGS }
