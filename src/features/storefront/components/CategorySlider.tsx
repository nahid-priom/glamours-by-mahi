import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { STOREFRONT_CATEGORIES } from '@/lib/constants'
import { getCategoryFallback } from '../lib/category-images'
import { CategoryImage } from './CategoryImage'

/** Single compact "Shop by Category" row shown directly below the hero. */
export function CategorySlider() {
  return (
    <section
      className="sf-container max-w-[1440px] py-5 sm:py-6"
      aria-label="Shop by category"
    >
      <div className="mb-3 flex items-end justify-between gap-3 sm:mb-4">
        <h2 className="font-serif text-lg text-[var(--sf-ink)] sm:text-xl">
          Shop by Category
        </h2>
        <Link
          to="/shop"
          className="flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--sf-primary)] sm:text-sm"
        >
          View All <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      <div
        className={
          'flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 scrollbar-hide ' +
          'lg:grid lg:grid-cols-8 lg:overflow-visible lg:pb-0'
        }
      >
        {STOREFRONT_CATEGORIES.map((cat) => (
          <Link
            key={cat.slug}
            to={`/category/${cat.slug}`}
            className="group w-[26%] min-w-[96px] shrink-0 snap-start text-center lg:w-auto lg:min-w-0"
          >
            <CategoryImage
              src={getCategoryFallback(cat.slug)}
              alt={cat.label}
              className="rounded-2xl border border-[var(--sf-border)] bg-white transition duration-300 group-hover:-translate-y-0.5 group-hover:border-[var(--sf-primary)] group-hover:shadow-[0_16px_40px_-24px_rgba(255,63,127,0.45)]"
              imgClassName="transition-transform duration-300 group-hover:scale-105"
            />
            <h3 className="mt-2 line-clamp-1 text-xs font-semibold text-[var(--sf-ink)] sm:text-sm">
              {cat.label}
            </h3>
          </Link>
        ))}
      </div>
    </section>
  )
}
