import { useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { StorefrontProduct } from '../storefront.types'
import { ProductCard } from './ProductCard'
import { cn } from '@/lib/utils'

interface ProductCarouselProps {
  products: StorefrontProduct[]
  title?: string
  subtitle?: string
  autoScroll?: boolean
  cardClassName?: string
}

export function ProductCarousel({
  products,
  title,
  subtitle,
  autoScroll = false,
  cardClassName,
}: ProductCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!autoScroll || !scrollRef.current) return
    const el = scrollRef.current
    const id = setInterval(() => {
      el.scrollBy({ left: 280, behavior: 'smooth' })
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 10) {
        el.scrollTo({ left: 0, behavior: 'smooth' })
      }
    }, 4000)
    return () => clearInterval(id)
  }, [autoScroll, products.length])

  const scroll = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 320, behavior: 'smooth' })
  }

  if (products.length === 0) return null

  return (
    <div>
      {(title || subtitle) && (
        <div className="mb-8">
          {subtitle && <p className="text-[11px] uppercase tracking-[0.3em] text-[#6B7280]">{subtitle}</p>}
          {title && <h2 className="mt-2 font-serif text-3xl text-[#111111] sm:text-4xl">{title}</h2>}
        </div>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => scroll(-1)}
          className="absolute -left-2 top-[38%] z-10 hidden h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg lg:flex"
          aria-label="Previous"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide sm:gap-5"
        >
          {products.map((p) => (
            <ProductCard key={p.id} product={p} className={cn('w-[220px] shrink-0 sm:w-[260px]', cardClassName)} />
          ))}
        </div>
        <button
          type="button"
          onClick={() => scroll(1)}
          className="absolute -right-2 top-[38%] z-10 hidden h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg lg:flex"
          aria-label="Next"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
