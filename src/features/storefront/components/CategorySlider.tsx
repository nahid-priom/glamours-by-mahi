import { Link } from 'react-router-dom'
import { CATEGORY_IMAGE_POOLS } from '@/lib/product-images'
import { LazyImage } from './LazyImage'

const CATEGORIES = [
  { slug: 'new-arrival', label: 'New Arrival', pool: 'lifestyle' as const },
  { slug: 'dress', label: 'Dresses', pool: 'dress' as const },
  { slug: 'co-ord-set', label: 'Co-Ord Set', pool: 'co-ord-set' as const },
  { slug: 'tops-tunic', label: 'Tops & Tunic', pool: 'tops-tunic' as const },
  { slug: 'kurti', label: 'Kurti', pool: 'kurti' as const },
  { slug: 'accessories', label: 'Accessories', pool: 'accessories' as const },
  { slug: 'sale', label: 'Sale', pool: 'dress' as const },
]

export function CategorySlider() {
  return (
    <section className="bg-[#F8F6F2] px-4 py-4 sm:px-6 lg:py-16">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#6B7280]">Browse</p>
            <h2 className="mt-2 font-serif text-3xl text-[#111111] sm:text-4xl">Shop by Category</h2>
          </div>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide lg:grid lg:grid-cols-7 lg:overflow-visible lg:gap-5">
          {CATEGORIES.map((cat, i) => {
            const pool = CATEGORY_IMAGE_POOLS[cat.pool]
            const image = pool[i % pool.length]
            return (
              <Link
                key={cat.slug}
                to={`/category/${cat.slug}`}
                className="group w-[140px] shrink-0 lg:w-auto"
              >
                <div className="overflow-hidden rounded-2xl bg-white shadow-[0_8px_30px_-12px_rgba(17,17,17,0.12)]">
                  <div className="overflow-hidden">
                    <LazyImage
                      src={image}
                      alt={cat.label}
                      aspectRatio="portrait"
                      className="transition duration-500 group-hover:scale-105"
                    />
                  </div>
                  <p className="px-3 py-3 text-center text-sm font-medium text-[#111111]">{cat.label}</p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
