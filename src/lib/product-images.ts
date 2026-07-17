import {
  DEFAULT_PRODUCT_IMAGE,
  getStableDemoProductImage,
} from '@/lib/images/product-image-utils'

export const FALLBACK_PRODUCT_IMAGE = DEFAULT_PRODUCT_IMAGE

// Legacy catalog metadata now resolves to the verified local demo set.
const img = (id: string, _width = 800) => getStableDemoProductImage(id)

export const CATEGORY_IMAGE_POOLS = {
  dress: [
    img('1595777457583-95e05998dd29'),
    img('1572804013309-59aaff8819f4'),
    img('1496747611176-843222e1e57c'),
    img('1515372039744-b8f02a3ae446'),
    img('1539008835657-9e8e9680c956'),
    img('1558618666-fcd25c85cd64'),
    img('1566174053879-31528523f8ae'),
    img('1594633312681-4257743c4c9e'),
  ],
  'co-ord-set': [
    img('1483985988355-763728dc32e1'),
    img('1469334031218-e382a71b716b'),
    img('1509631179647-0177331693ae'),
    img('1525507119025-353db7563e83'),
  ],
  kurti: [
    img('1581044777550-4cfa60707c03'),
    img('1610030469983-98e550385618'),
    img('1591369620205-4a6926c4a38a'),
    img('1583496660940-965a0a2d4a0a'),
  ],
  'tops-tunic': [
    img('1509631179647-0177331693ae'),
    img('1525507119025-353db7563e83'),
    img('1434389677669-e08b4cac3105'),
    img('1487222477124-7e7757e37872'),
  ],
  accessories: [
    img('1515562141203-7a88fb7ece69'),
    img('1605100804763-247f67b3557e'),
    img('1611595437941-53c9610c5e7b'),
    img('1535632066927-ab7c754de088'),
  ],
  shoes: [
    img('1543163521-1bf539c55dd2'),
    img('1560769629-845ec4e4c76b'),
    img('1549298916-b41d501d3772'),
  ],
  bags: [
    img('1584917865442-de89ae76bddb'),
    img('1594223274512-ad4803739b7c'),
    img('1590874103328-eac88a683a5f'),
  ],
  lifestyle: [
    img('1441986300917-64674bd600d8'),
    img('1469334031218-e382a71b716b'),
    img('1490481651871-ab68de25d43d'),
  ],
} as const

export const HERO_SLIDES = [
  {
    image: img('1469334031218-e382a71b716b', 1800),
    alt: 'Beauty fashion and lifestyle editorial',
    headline: ['Everyday', 'Glamour'],
    badgeTop: 'Beauty · Fashion · Lifestyle',
    badgeBottom: 'Glamourous by Mahi',
    subtitle:
      'Authentic cosmetics, trendy fashion and premium lifestyle products — সবকিছু এক জায়গায়.',
    accentLabel: 'Shop the edit',
  },
  {
    image: img('1490481651871-ab68de25d43d', 1800),
    alt: 'Premium beauty and fashion collection',
    headline: ['New', 'Arrivals'],
    badgeTop: 'Just Dropped',
    badgeBottom: 'Weekly curated edit',
    subtitle:
      'Fresh beauty essentials and fashion picks selected for modern women across Bangladesh.',
    accentLabel: 'Explore new',
  },
  {
    image: img('1515372039744-b8f02a3ae446', 1800),
    alt: 'Festive dress and beauty styling',
    headline: ['Festive', 'Edit'],
    badgeTop: 'Occasion Ready',
    badgeBottom: 'Dress · Makeup · Accessories',
    subtitle:
      'Statement dresses, soft glam makeup and finishing accessories for your next celebration.',
    accentLabel: 'Shop festive',
  },
] as const

export type HeroSlide = (typeof HERO_SLIDES)[number]

export const INSTAGRAM_IMAGES = [
  img('1595777457583-95e05998dd29', 600),
  img('1483985988355-763728dc32e1', 600),
  img('1581044777550-4cfa60707c03', 600),
  img('1515562141203-7a88fb7ece69', 600),
  img('1584917865442-de89ae76bddb', 600),
  img('1543163521-1bf539c55dd2', 600),
  img('1572804013309-59aaff8819f4', 600),
  img('1605100804763-247f67b3557e', 600),
] as const

export interface ProductImageMeta {
  main: string
  hover: string
  gallery: string[]
  alt: string
}

function hashSku(sku: string): number {
  return sku.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
}

export function getImagesForCategory(
  category: keyof typeof CATEGORY_IMAGE_POOLS,
  sku: string,
  name: string,
): ProductImageMeta {
  const pool = CATEGORY_IMAGE_POOLS[category] ?? CATEGORY_IMAGE_POOLS.lifestyle
  const idx = hashSku(sku) % pool.length
  const main = pool[idx]
  const hover = pool[(idx + 1) % pool.length]
  const gallery = [main, hover, pool[(idx + 2) % pool.length]]
  return { main, hover, gallery, alt: name }
}

export function getProductImageMeta(
  sku: string,
  name: string,
  category: keyof typeof CATEGORY_IMAGE_POOLS = 'dress',
): ProductImageMeta {
  return getImagesForCategory(category, sku, name)
}

/** @deprecated use CATEGORY_IMAGE_POOLS */
export const PRODUCT_IMAGES = {
  dress1: CATEGORY_IMAGE_POOLS.dress[0],
  hero1: HERO_SLIDES[0].image,
  hero2: HERO_SLIDES[1].image,
  lifestyle1: CATEGORY_IMAGE_POOLS.lifestyle[0],
} as const
