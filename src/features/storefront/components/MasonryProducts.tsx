import type { StorefrontProduct } from '../storefront.types'
import { ProductCard } from './ProductCard'
import { cn } from '@/lib/utils'

interface MasonryProductsProps {
  products: StorefrontProduct[]
}

export function MasonryProducts({ products }: MasonryProductsProps) {
  if (products.length === 0) return null

  return (
    <div className="columns-2 gap-4 sm:columns-3 lg:columns-5 lg:gap-5">
      {products.map((product, i) => (
        <div
          key={product.id}
          className={cn(
            'mb-4 break-inside-avoid lg:mb-5',
            i % 5 === 0 && 'lg:mt-8',
            i % 7 === 0 && 'scale-[1.02]',
          )}
        >
          <ProductCard product={product} variant={i % 4 === 0 ? 'large' : 'default'} />
        </div>
      ))}
    </div>
  )
}
