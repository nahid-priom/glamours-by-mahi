import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { PRODUCT_PLACEHOLDER } from '@/lib/images/image-utils'
import { useReliableImage } from '@/lib/images/use-reliable-image'

type CategoryImageProps = {
  src?: string | null
  fallbackSrc?: string | null
  alt: string
  className?: string
  imgClassName?: string
}

/**
 * Shared square category image: skeleton while genuinely loading, one-shot
 * fallback chain (primary → fallback → static placeholder), cached-image
 * detection after SPA navigation, fixed aspect ratio to prevent layout shift.
 */
export function CategoryImage({
  src,
  fallbackSrc,
  alt,
  className,
  imgClassName,
}: CategoryImageProps) {
  const { imgRef, currentSrc, status, handleLoad, handleError } = useReliableImage(src, [
    fallbackSrc,
    PRODUCT_PLACEHOLDER,
  ])

  return (
    <div className={cn('relative aspect-square overflow-hidden bg-stone-100', className)}>
      {status === 'loading' && <Skeleton className="absolute inset-0 z-10 rounded-none" />}
      <img
        ref={imgRef}
        src={currentSrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
        className={cn(
          'h-full w-full object-cover object-center transition-opacity duration-300',
          status === 'loaded' ? 'opacity-100' : 'opacity-0',
          imgClassName,
        )}
      />
    </div>
  )
}
