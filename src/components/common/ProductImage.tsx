import { AppImage } from './AppImage'
import {
  DEFAULT_PRODUCT_IMAGE,
  resolveProductImage,
  type ProductImageSource,
} from '@/lib/images/product-image-utils'

type ProductImageProps = {
  product: ProductImageSource
  alt?: string
  className?: string
  imgClassName?: string
  loading?: 'lazy' | 'eager'
  aspectRatio?: 'square' | 'portrait' | 'video' | 'auto'
  objectFit?: 'cover' | 'contain' | 'fill'
  sizes?: string
}

/**
 * Shared product image renderer. The resolver is deterministic, and AppImage
 * provides the loading skeleton plus a single guarded fallback on failure.
 */
export function ProductImage({
  product,
  alt,
  className,
  imgClassName,
  loading = 'lazy',
  aspectRatio = 'auto',
  objectFit = 'cover',
  sizes,
}: ProductImageProps) {
  return (
    <AppImage
      src={resolveProductImage(product)}
      fallbackSrc={DEFAULT_PRODUCT_IMAGE}
      alt={alt?.trim() || product.name?.trim() || 'Product'}
      className={className}
      imgClassName={imgClassName}
      loading={loading}
      aspectRatio={aspectRatio}
      objectFit={objectFit}
      sizes={sizes}
    />
  )
}
