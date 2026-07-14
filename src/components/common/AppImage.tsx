import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { getFallbackImage, isValidImageSource, normalizeImageUrl } from '@/lib/images/image-utils'

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
  sizes?: string
}

const aspectClasses: Record<AspectRatio, string> = {
  square: 'aspect-square',
  portrait: 'aspect-[4/5]',
  video: 'aspect-video',
  auto: '',
}

export function AppImage({
  src,
  fallbackSrc = getFallbackImage(),
  alt,
  className,
  imgClassName,
  aspectRatio = 'auto',
  objectFit = 'cover',
  loading = 'lazy',
  sizes,
}: AppImageProps) {
  const resolved = isValidImageSource(src) ? normalizeImageUrl(src, fallbackSrc) : fallbackSrc
  const [currentSrc, setCurrentSrc] = useState(resolved)
  const [loaded, setLoaded] = useState(false)
  const [usedFallback, setUsedFallback] = useState(false)

  useEffect(() => {
    setCurrentSrc(resolved)
    setLoaded(false)
    setUsedFallback(false)
  }, [resolved])

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-[#F3F0EB]',
        aspectClasses[aspectRatio],
        className,
      )}
    >
      {!loaded && <Skeleton className="absolute inset-0 rounded-none" />}
      <img
        src={currentSrc}
        alt={alt}
        loading={loading}
        decoding="async"
        sizes={sizes}
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (!usedFallback && currentSrc !== fallbackSrc) {
            setUsedFallback(true)
            setCurrentSrc(fallbackSrc)
            setLoaded(true)
          } else {
            setLoaded(true)
          }
        }}
        className={cn(
          'h-full w-full transition-opacity duration-300',
          objectFit === 'cover' && 'object-cover',
          objectFit === 'contain' && 'object-contain',
          objectFit === 'fill' && 'object-fill',
          loaded ? 'opacity-100' : 'opacity-0',
          imgClassName,
        )}
      />
    </div>
  )
}
