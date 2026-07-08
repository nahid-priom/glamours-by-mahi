import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { CATEGORY_IMAGE_POOLS } from '@/lib/product-images'
import type { StorefrontProduct } from '../storefront.types'
import { ProductCard } from './ProductCard'
import { LazyImage } from './LazyImage'

interface FeaturedCollectionProps {
  products: StorefrontProduct[]
}

export function FeaturedCollection({ products }: FeaturedCollectionProps) {
  return (
    <section className="px-4 py-4 sm:px-6 lg:py-16">
      <div className="mx-auto grid max-w-[1400px] gap-8 lg:grid-cols-2 lg:gap-10">
        <Link
          to="/shop"
          className="group relative min-h-[400px] overflow-hidden rounded-2xl lg:min-h-[560px]"
        >
          <LazyImage
            src={CATEGORY_IMAGE_POOLS.dress[3]}
            alt="Featured collection banner"
            aspectRatio="portrait"
            className="h-full min-h-[400px] transition duration-700 group-hover:scale-105 lg:min-h-[560px]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-0 left-0 p-8 sm:p-10">
            <p className="text-[11px] uppercase tracking-[0.3em] text-white/70">Editorial Pick</p>
            <h2 className="mt-2 font-serif text-3xl text-white sm:text-4xl">The Signature Collection</h2>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-white">
              Shop Featured <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </span>
          </div>
        </Link>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {products.slice(0, 4).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  )
}
