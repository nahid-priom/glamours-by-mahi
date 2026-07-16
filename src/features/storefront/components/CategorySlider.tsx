import { Link } from 'react-router-dom'
import { CATEGORY_IMAGE_POOLS } from '@/lib/product-images'
import { LazyImage } from './LazyImage'

const CATEGORIES = [
  { slug: 'new-arrival', label: 'New Arrivals', pool: 'lifestyle' as const },
  { slug: 'dress', label: 'Dress', pool: 'dress' as const },
  { slug: 'co-ord-set', label: 'Co-ords', pool: 'co-ord-set' as const },
  { slug: 'tops-tunic', label: 'Tops & Tunic', pool: 'tops-tunic' as const },
  { slug: 'kurti', label: 'Kurti', pool: 'kurti' as const },
  { slug: 'accessories', label: 'Accessories', pool: 'accessories' as const },
  { slug: 'sale', label: 'Offers', pool: 'dress' as const },
]

export function CategorySlider() {
  return (
    <section className="sf-container max-w-[1440px] py-10 lg:py-16">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--sf-muted)]">Browse</p>
          <h2 className="mt-2 font-serif text-2xl text-[var(--sf-ink)] sm:text-3xl lg:text-4xl">
            Shop by Category
          </h2>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
        {CATEGORIES.map((cat, i) => {
          const pool = CATEGORY_IMAGE_POOLS[cat.pool]
          const image = pool[i % pool.length]
          return (
            <Link key={cat.slug} to={`/category/${cat.slug}`} className="group">
              <div className="overflow-hidden rounded-2xl border border-[var(--sf-border)] bg-white transition duration-300 hover:-translate-y-0.5 hover:border-[var(--sf-primary)] hover:shadow-[0_16px_40px_-24px_rgba(255,63,127,0.45)]">
                <div className="overflow-hidden">
                  <LazyImage
                    src={image}
                    alt={cat.label}
                    aspectRatio="portrait"
                    className="transition duration-500 group-hover:scale-105"
                  />
                </div>
                <p className="px-3 py-3 text-center text-sm font-semibold text-[var(--sf-ink)]">
                  {cat.label}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
