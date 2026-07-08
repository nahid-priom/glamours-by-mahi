import { Link } from 'react-router-dom'
import { CATEGORY_IMAGE_POOLS } from '@/lib/product-images'
import type { StyleTag } from '@/lib/fashion-catalog'
import { LazyImage } from './LazyImage'

const STYLES: { slug: StyleTag; label: string; image: string }[] = [
  { slug: 'office', label: 'Office', image: CATEGORY_IMAGE_POOLS['tops-tunic'][0] },
  { slug: 'party', label: 'Party', image: CATEGORY_IMAGE_POOLS.dress[1] },
  { slug: 'wedding', label: 'Wedding', image: CATEGORY_IMAGE_POOLS.dress[4] },
  { slug: 'casual', label: 'Casual', image: CATEGORY_IMAGE_POOLS['co-ord-set'][0] },
  { slug: 'summer', label: 'Summer', image: CATEGORY_IMAGE_POOLS.dress[2] },
  { slug: 'winter', label: 'Winter', image: CATEGORY_IMAGE_POOLS.kurti[0] },
]

export function ShopByStyle() {
  return (
    <section className="bg-white px-4 py-4 sm:px-6 lg:py-16">
      <div className="mx-auto max-w-[1400px]">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#6B7280]">Curated for you</p>
        <h2 className="mt-2 font-serif text-3xl text-[#111111] sm:text-4xl">Shop by Style</h2>
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:gap-6">
          {STYLES.map((style) => (
            <Link
              key={style.slug}
              to={`/shop?style=${style.slug}`}
              className="group relative overflow-hidden rounded-2xl"
            >
              <LazyImage
                src={style.image}
                alt={style.label}
                aspectRatio="portrait"
                className="transition duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/25 transition group-hover:bg-black/35" />
              <p className="absolute bottom-4 left-4 font-serif text-xl text-white sm:text-2xl">{style.label}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
