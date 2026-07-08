import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowRight, Shield, Truck, RotateCcw, CreditCard } from 'lucide-react'
import { storefrontService } from './storefront.service'
import { HeroBanner } from './components/HeroBanner'
import { CategorySlider } from './components/CategorySlider'
import { ProductCard } from './components/ProductCard'
import { ProductCarousel } from './components/ProductCarousel'
import { MasonryProducts } from './components/MasonryProducts'
import { LimitedCollection } from './components/LimitedCollection'
import { FeaturedCollection } from './components/FeaturedCollection'
import { ShopByStyle } from './components/ShopByStyle'
import { InstagramGallery } from './components/InstagramGallery'
import { TestimonialSection } from './components/TestimonialSection'
import { NewsletterSection } from './components/NewsletterSection'
import { Skeleton } from '@/components/ui/skeleton'

function SectionSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="aspect-[4/5] rounded-2xl" />
      ))}
    </div>
  )
}

export function HomePage() {
  const { data: newArrivals, isLoading: l1 } = useQuery({
    queryKey: ['storefront', 'new-arrivals'],
    queryFn: () => storefrontService.getNewArrivals(12),
  })
  const { data: trending, isLoading: l2 } = useQuery({
    queryKey: ['storefront', 'trending'],
    queryFn: () => storefrontService.getTrending(14),
  })
  const { data: limited } = useQuery({
    queryKey: ['storefront', 'limited'],
    queryFn: () => storefrontService.getLimited(6),
  })
  const { data: bestSellers, isLoading: l3 } = useQuery({
    queryKey: ['storefront', 'best-sellers'],
    queryFn: () => storefrontService.getBestSellers(16),
  })
  const { data: featured } = useQuery({
    queryKey: ['storefront', 'featured'],
    queryFn: () => storefrontService.getFeatured(8),
  })
  const { data: recent, isLoading: l4 } = useQuery({
    queryKey: ['storefront', 'recent'],
    queryFn: () => storefrontService.getRecentlyAdded(12),
  })

  return (
    <div className="overflow-x-hidden">
      <HeroBanner />
      <CategorySlider />

      {/* New Arrivals — 4-col grid */}
      <section className="px-4 py-4 sm:px-6 lg:py-16">
        <div className="mx-auto max-w-[1400px]">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-[#6B7280]">Just dropped</p>
              <h2 className="mt-2 font-serif text-3xl text-[#111111] sm:text-4xl">New Arrivals</h2>
            </div>
            <Link to="/category/new-arrival" className="hidden items-center gap-1 text-sm font-medium text-[#111111] sm:flex">
              View All <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {l1 ? <SectionSkeleton /> : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5 xl:gap-5">
              {newArrivals?.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </div>
      </section>

      {/* Trending — horizontal slider */}
      <section className="bg-white px-4 py-4 sm:px-6 lg:py-16">
        <div className="mx-auto max-w-[1400px]">
          {l2 ? <SectionSkeleton /> : (
            <ProductCarousel products={trending ?? []} title="Trending Now" subtitle="Most loved this week" autoScroll />
          )}
        </div>
      </section>

      {/* Limited Collection — dark editorial */}
      {limited && limited.length > 0 && <LimitedCollection products={limited} />}

      {/* Best Sellers — masonry */}
      <section className="px-4 py-4 sm:px-6 lg:py-16">
        <div className="mx-auto max-w-[1400px]">
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#6B7280]">Customer favorites</p>
          <h2 className="mt-2 font-serif text-3xl text-[#111111] sm:text-4xl">Best Sellers</h2>
          <div className="mt-10">
            {l3 ? <SectionSkeleton /> : <MasonryProducts products={bestSellers ?? []} />}
          </div>
        </div>
      </section>

      {/* Featured — banner + grid */}
      {featured && featured.length > 0 && <FeaturedCollection products={featured} />}

      <ShopByStyle />

      {/* Recently Added — carousel */}
      <section className="bg-[#F8F6F2] px-4 py-4 sm:px-6 lg:py-16">
        <div className="mx-auto max-w-[1400px]">
          {l4 ? <SectionSkeleton /> : (
            <ProductCarousel products={recent ?? []} title="Recently Added" subtitle="Fresh from our atelier" />
          )}
        </div>
      </section>

      <InstagramGallery />
      <TestimonialSection />

      {/* Why shop with us */}
      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
          {[
            { icon: Truck, title: 'Fast Delivery', desc: 'Nationwide COD' },
            { icon: CreditCard, title: 'Cash on Delivery', desc: 'Pay on receipt' },
            { icon: Shield, title: 'Premium Quality', desc: 'Curated fabrics' },
            { icon: RotateCcw, title: 'Easy Exchange', desc: '3-day policy' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl bg-white p-6 text-center shadow-[0_4px_24px_-8px_rgba(17,17,17,0.08)]">
              <Icon className="mx-auto h-6 w-6 text-[#E11D48]" />
              <p className="mt-3 text-sm font-semibold text-[#111111]">{title}</p>
              <p className="mt-1 text-xs text-[#6B7280]">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <NewsletterSection />
    </div>
  )
}
