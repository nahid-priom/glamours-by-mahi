import { useState } from 'react'
import { FALLBACK_PRODUCT_IMAGE } from '@/lib/product-images'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

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
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const imgSrc = error ? FALLBACK_PRODUCT_IMAGE : src

  return (
    <div className={cn('relative overflow-hidden bg-stone-100', aspectClasses[aspectRatio], className)}>
      {!loaded && <Skeleton className="absolute inset-0 rounded-none" />}
      <img
        src={imgSrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        onLoad={() => setLoaded(true)}
        onError={() => {
          setError(true)
          setLoaded(true)
        }}
        className={cn(
          'h-full w-full object-cover transition-opacity duration-300',
          loaded ? 'opacity-100' : 'opacity-0',
          imgClassName,
        )}
      />
    </div>
  )
}
