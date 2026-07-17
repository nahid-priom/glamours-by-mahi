import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { getFallbackImage, PRODUCT_PLACEHOLDER } from '@/lib/images/image-utils'
import { useReliableImage } from '@/lib/images/use-reliable-image'
import { ImageOff } from 'lucide-react'

type AspectRatio = 'square' | 'portrait' | 'video' | 'auto'
type ObjectFit = 'cover' | 'contain' | 'fill'

interface AppImageProps {
  src?: string | null
  fallbackSrc?: string
  alt: string
  className?: string
  imgClassName?: string
  aspectRatio?: AspectRatio
  objectFit?: ObjectFit
  loading?: 'lazy' | 'eager'
  fetchPriority?: 'high' | 'low' | 'auto'
  sizes?: string
}

const aspectClasses: Record<AspectRatio, string> = {
  square: 'aspect-square',
  portrait: 'aspect-[4/5]',
  video: 'aspect-video',
  auto: '',
}

/**
 * Single reliable image component (hero/category/product renderers compose it).
 * Handles cached-image detection after SPA navigation, one-shot fallback
 * chaining and a styled terminal placeholder — never a broken-image icon.
 */
export function AppImage({
  src,
  fallbackSrc = getFallbackImage(),
  alt,
  className,
  imgClassName,
  aspectRatio = 'auto',
  objectFit = 'cover',
  loading = 'lazy',
  fetchPriority,
  sizes,
}: AppImageProps) {
  const { imgRef, currentSrc, status, handleLoad, handleError } = useReliableImage(src, [
    fallbackSrc,
    PRODUCT_PLACEHOLDER,
  ])

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-[#F3F0EB]',
        aspectClasses[aspectRatio],
        className,
      )}
    >
      {status === 'loading' && <Skeleton className="absolute inset-0 z-10 rounded-none" />}

      {status === 'error' ? (
        <div
          role="img"
          aria-label={alt}
          className="flex h-full w-full flex-col items-center justify-center gap-1.5 p-2 text-center text-slate-400"
        >
          <ImageOff className="h-5 w-5" aria-hidden />
          <span className="line-clamp-2 text-[10px] font-medium">{alt}</span>
        </div>
      ) : (
        <img
          ref={imgRef}
          src={currentSrc}
          alt={alt}
          loading={loading}
          decoding="async"
          fetchPriority={fetchPriority}
          sizes={sizes}
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            'h-full w-full transition-opacity duration-300',
            objectFit === 'cover' && 'object-cover',
            objectFit === 'contain' && 'object-contain',
            objectFit === 'fill' && 'object-fill',
            status === 'loaded' ? 'opacity-100' : 'opacity-0',
            imgClassName,
          )}
        />
      )}
    </div>
  )
}
