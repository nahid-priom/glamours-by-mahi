import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { FALLBACK_PRODUCT_IMAGE } from '@/lib/product-images'
import { Skeleton } from '@/components/ui/skeleton'
import type { StorefrontProduct } from '../storefront.types'
import { getDisplayAlt, getDisplayGallery } from '../utils/product-display'

interface ProductGalleryProps {
  product: StorefrontProduct
  className?: string
}

function MobileGallery({
  images,
  alt,
  activeIndex,
  onIndexChange,
}: {
  images: string[]
  alt: string
  activeIndex: number
  onIndexChange: (index: number) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState<Record<number, boolean>>({})

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const index = Math.round(el.scrollLeft / el.clientWidth)
    onIndexChange(index)
  }

  const scrollToIndex = (index: number) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ left: el.clientWidth * index, behavior: 'smooth' })
    onIndexChange(index)
  }

  return (
    <>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {images.map((src, index) => (
          <div key={`${src}-${index}`} className="w-full shrink-0 snap-center overflow-hidden rounded-3xl bg-white">
            <div className="relative aspect-[4/5] bg-[#F8F6F2]">
              {!loaded[index] && <Skeleton className="absolute inset-0" />}
              <img
                src={src}
                alt={alt}
                loading={index === 0 ? 'eager' : 'lazy'}
                decoding="async"
                onLoad={() => setLoaded((prev) => ({ ...prev, [index]: true }))}
                onError={() => setLoaded((prev) => ({ ...prev, [index]: true }))}
                className={cn(
                  'h-full w-full object-cover transition-opacity duration-300',
                  loaded[index] ? 'opacity-100' : 'opacity-0',
                )}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-center gap-1.5">
        {images.map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => scrollToIndex(index)}
            className={cn(
              'h-1.5 rounded-full transition-all',
              activeIndex === index ? 'w-5 bg-[#111111]' : 'w-1.5 bg-[#111111]/20',
            )}
            aria-label={`View image ${index + 1}`}
          />
        ))}
      </div>
    </>
  )
}

export function ProductGallery({ product, className }: ProductGalleryProps) {
  const images = getDisplayGallery(product)
  const alt = getDisplayAlt(product)
  const [activeIndex, setActiveIndex] = useState(0)
  const [zoomed, setZoomed] = useState(false)
  const [loaded, setLoaded] = useState<Record<number, boolean>>({})

  const activeImage = images[activeIndex] ?? FALLBACK_PRODUCT_IMAGE

  return (
    <div className={cn('min-w-0', className)}>
      <div className="lg:hidden">
        <MobileGallery images={images} alt={alt} activeIndex={activeIndex} onIndexChange={setActiveIndex} />
      </div>

      {/* Desktop gallery */}
      <div className="hidden gap-4 lg:grid lg:grid-cols-[88px_1fr]">
        {images.length > 1 && (
          <div className="flex flex-col gap-3">
            {images.map((src, index) => (
              <button
                key={`${src}-thumb-${index}`}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={cn(
                  'relative aspect-[4/5] overflow-hidden rounded-2xl border-2 bg-[#F8F6F2] transition',
                  activeIndex === index ? 'border-[#111111]' : 'border-transparent opacity-70 hover:opacity-100',
                )}
              >
                <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div
          className="group relative overflow-hidden rounded-[32px] bg-white shadow-[0_8px_40px_-16px_rgba(17,17,17,0.12)]"
          onMouseEnter={() => setZoomed(true)}
          onMouseLeave={() => setZoomed(false)}
        >
          <div className="relative aspect-[4/5] bg-[#F8F6F2]">
            {!loaded[activeIndex] && <Skeleton className="absolute inset-0 rounded-[32px]" />}
            <img
              src={activeImage}
              alt={alt}
              loading="eager"
              decoding="async"
              onLoad={() => setLoaded((prev) => ({ ...prev, [activeIndex]: true }))}
              onError={() => setLoaded((prev) => ({ ...prev, [activeIndex]: true }))}
              className={cn(
                'h-full w-full object-cover transition-all duration-500',
                loaded[activeIndex] ? 'opacity-100' : 'opacity-0',
                zoomed && 'scale-110',
              )}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
