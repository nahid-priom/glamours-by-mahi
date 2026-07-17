import { FALLBACK_PRODUCT_IMAGE } from '@/lib/product-images'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { useReliableImage } from '@/lib/images/use-reliable-image'

interface LazyImageProps {
  src: string
  alt: string
  className?: string
  imgClassName?: string
  aspectRatio?: 'square' | 'portrait' | 'hero'
}

const aspectClasses = {
  square: 'aspect-square',
  portrait: 'aspect-[3/4]',
  hero: 'aspect-[16/9] sm:aspect-[21/9]',
}

export function LazyImage({
  src,
  alt,
  className,
  imgClassName,
  aspectRatio = 'portrait',
}: LazyImageProps) {
  const { imgRef, currentSrc, status, handleLoad, handleError } = useReliableImage(src, [
    FALLBACK_PRODUCT_IMAGE,
  ])

  return (
    <div className={cn('relative overflow-hidden bg-stone-100', aspectClasses[aspectRatio], className)}>
      {status === 'loading' && <Skeleton className="absolute inset-0 z-10 rounded-none" />}
      <img
        ref={imgRef}
        src={currentSrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        onLoad={handleLoad}
        onError={handleError}
        className={cn(
          'h-full w-full object-cover transition-opacity duration-300',
          status === 'loaded' ? 'opacity-100' : 'opacity-0',
          imgClassName,
        )}
      />
    </div>
  )
}
