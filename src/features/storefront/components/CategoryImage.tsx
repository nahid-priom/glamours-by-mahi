import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { PRODUCT_PLACEHOLDER } from '@/lib/images/image-utils'

type CategoryImageProps = {
  src?: string | null
  fallbackSrc?: string | null
  alt: string
  className?: string
  imgClassName?: string
}

type Stage = 'primary' | 'fallback' | 'placeholder'

/**
 * Shared square category image with skeleton, single-step error fallback
 * (primary → fallback → static placeholder, never a retry loop) and a fixed
 * aspect ratio to prevent layout shift.
 */
export function CategoryImage({
  src,
  fallbackSrc,
  alt,
  className,
  imgClassName,
}: CategoryImageProps) {
  const [stage, setStage] = useState<Stage>(src ? 'primary' : fallbackSrc ? 'fallback' : 'placeholder')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setStage(src ? 'primary' : fallbackSrc ? 'fallback' : 'placeholder')
    setLoaded(false)
  }, [src, fallbackSrc])

  const resolved =
    stage === 'primary' ? src : stage === 'fallback' ? fallbackSrc : PRODUCT_PLACEHOLDER

  const handleError = () => {
    if (stage === 'primary' && fallbackSrc) {
      setStage('fallback')
      setLoaded(false)
      return
    }
    if (stage !== 'placeholder') {
      setStage('placeholder')
      setLoaded(true)
    }
  }

  return (
    <div className={cn('relative aspect-square overflow-hidden bg-stone-100', className)}>
      {!loaded ? <Skeleton className="absolute inset-0 rounded-none" /> : null}
      <img
        src={resolved ?? PRODUCT_PLACEHOLDER}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={handleError}
        className={cn(
          'h-full w-full object-cover object-center transition-opacity duration-300',
          loaded ? 'opacity-100' : 'opacity-0',
          imgClassName,
        )}
      />
    </div>
  )
}
