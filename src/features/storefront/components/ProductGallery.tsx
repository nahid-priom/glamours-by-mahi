import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { ProductImage } from '@/components/common/ProductImage'
import { getStableAdditionalImages } from '@/lib/images/product-image-utils'
import type { StorefrontProduct } from '../storefront.types'
import { getDisplayAlt, getDisplayGallery, getDisplayImage } from '../utils/product-display'

interface ProductGalleryProps {
  product: StorefrontProduct
  /** When a variant is selected, prefer its image as the active cover */
  activeVariantImage?: string | null
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

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ left: el.clientWidth * activeIndex, behavior: 'smooth' })
  }, [activeIndex])

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const index = Math.round(el.scrollLeft / Math.max(el.clientWidth, 1))
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
            <ProductImage
              product={{ id: `${alt}-${index}`, name: alt, imageUrl: src }}
              alt={alt}
              aspectRatio="square"
              className="w-full"
              loading={index === 0 ? 'eager' : 'lazy'}
              objectFit="cover"
            />
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
              activeIndex === index ? 'w-5 bg-[#22171C]' : 'w-1.5 bg-[#22171C]/20',
            )}
            aria-label={`View image ${index + 1}`}
          />
        ))}
      </div>
    </>
  )
}

const MIN_GALLERY_IMAGES = 4

export function ProductGallery({ product, activeVariantImage, className }: ProductGalleryProps) {
  const cover = getDisplayImage(product)
  const gallery = getDisplayGallery(product)
  const variantCover = activeVariantImage?.trim() || null
  // Exact cover always first, then the product's own remaining unique images.
  const ownImages = [
    ...(variantCover ? [variantCover] : []),
    cover,
    ...gallery.filter((url) => url !== cover && url !== variantCover),
  ]
    .filter((url, index, arr) => url && arr.indexOf(url) === index)
    .slice(0, 5)
  // Pad thin galleries with stable per-product extras so thumbnails never look empty.
  const images = [
    ...ownImages,
    ...getStableAdditionalImages(product.id, MIN_GALLERY_IMAGES - ownImages.length, ownImages),
  ]
  const alt = getDisplayAlt(product)
  const [activeIndex, setActiveIndex] = useState(0)
  const [zoomed, setZoomed] = useState(false)

  useEffect(() => {
    setActiveIndex(0)
  }, [variantCover, product.id])

  const activeImage = images[activeIndex] ?? cover

  return (
    <div className={cn('min-w-0', className)}>
      <div className="lg:hidden">
        <MobileGallery images={images} alt={alt} activeIndex={activeIndex} onIndexChange={setActiveIndex} />
      </div>

      <div className="hidden gap-4 lg:grid lg:max-w-[600px] lg:grid-cols-[88px_1fr]">
        {images.length > 1 && (
          <div className="flex flex-col gap-3">
            {images.map((src, index) => (
              <button
                key={`${src}-thumb-${index}`}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={cn(
                  'relative overflow-hidden rounded-2xl border-2 bg-[#FFF9FB] transition',
                  activeIndex === index ? 'border-[#22171C]' : 'border-transparent opacity-70 hover:opacity-100',
                )}
              >
                <ProductImage
                  product={{ id: `${product.id}-${index}`, name: alt, imageUrl: src }}
                  alt=""
                  aspectRatio="square"
                  className="w-full"
                  objectFit="cover"
                />
              </button>
            ))}
          </div>
        )}

        <div
          className="group relative overflow-hidden rounded-[32px] bg-white shadow-[0_8px_40px_-16px_rgba(17,17,17,0.12)]"
          onMouseEnter={() => setZoomed(true)}
          onMouseLeave={() => setZoomed(false)}
        >
          <ProductImage
            product={{ id: product.id, name: alt, imageUrl: activeImage }}
            alt={alt}
            aspectRatio="square"
            className="w-full"
            loading="eager"
            objectFit="cover"
            imgClassName={cn('transition-transform duration-500', zoomed && 'scale-110')}
          />
        </div>
      </div>
    </div>
  )
}
