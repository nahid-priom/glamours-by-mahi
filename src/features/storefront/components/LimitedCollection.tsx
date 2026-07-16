import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { HERO_SLIDES } from '@/lib/product-images'
import type { StorefrontProduct } from '../storefront.types'
import { ProductCard } from './ProductCard'
import { LazyImage } from './LazyImage'

interface LimitedCollectionProps {
  products: StorefrontProduct[]
}

export function LimitedCollection({ products }: LimitedCollectionProps) {
  const featured = products.slice(0, 2)

  return (
    <section className="bg-[#22171C] px-4 py-16 text-white sm:px-6 lg:py-24">
      <div className="mx-auto max-w-[1400px]">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
          <div className="relative overflow-hidden rounded-2xl lg:col-span-7 lg:min-h-[520px]">
            <LazyImage
              src={HERO_SLIDES[1].image}
              alt="Limited collection editorial"
              aspectRatio="hero"
              className="min-h-[320px] lg:min-h-full"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 p-8 sm:p-10">
              <p className="text-[11px] uppercase tracking-[0.35em] text-white/60">Limited Edition</p>
              <h2 className="mt-3 max-w-md font-serif text-3xl leading-tight sm:text-4xl lg:text-5xl">
                The Midnight Edit — Only 50 Pieces Worldwide
              </h2>
              <Link
                to="/category/new-arrival"
                className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-white underline-offset-4 hover:underline"
              >
                Explore Collection <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
          <div className="flex flex-col justify-center lg:col-span-5">
            <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">Curated Selection</p>
            <h3 className="mt-2 font-serif text-2xl">Featured from the Edit</h3>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
              {featured.map((p) => (
                <div key={p.id} className="rounded-2xl bg-white/5 p-3 backdrop-blur-sm">
                  <ProductCard product={p} variant="compact" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
