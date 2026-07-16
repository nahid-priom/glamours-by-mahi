import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { formatShowingRange } from '../lib/shop-utils'

interface CollectionHeroProps {
  title?: string
  total: number
  loaded: number
  page: number
  pageSize: number
}

export function CollectionHero({
  title = 'Shop All',
  total,
  loaded,
  page,
  pageSize,
}: CollectionHeroProps) {
  return (
    <section className="shop-collection-hero relative overflow-hidden">
      <div className="mx-auto max-w-[1400px] px-4 py-4 sm:px-6 sm:py-7">
        <div className="flex gap-4 sm:flex-row sm:items-start items-center justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-[#6B7280]">Collection</p>
            <h1 className="mt-2 font-serif text-3xl text-[#22171C] sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
              {title}
            </h1>
          </div>

          <div className="shrink-0 text-left sm:text-right">
            <nav className="flex items-center gap-1.5 text-xs text-[#6B7280] sm:justify-end">
              <Link to="/" className="transition hover:text-[#22171C]">
                Home
              </Link>
              <ChevronRight className="h-3 w-3 opacity-50" />
              <span className="font-medium text-[#22171C]">Shop</span>
            </nav>
            <p className="mt-2 text-xs text-[#6B7280] sm:text-sm">
              {formatShowingRange(page, pageSize, total, loaded)}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
