import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { storefrontService } from './storefront.service'
import { DynamicHeroCarousel } from './components/DynamicHeroCarousel'
import { BenefitStrip } from './components/BenefitStrip'
import { CategorySlider } from './components/CategorySlider'
import { ProductCard } from './components/ProductCard'
import { ProductCarousel } from './components/ProductCarousel'
import { MasonryProducts } from './components/MasonryProducts'
import { LimitedCollection } from './components/LimitedCollection'
import { FeaturedCollection } from './components/FeaturedCollection'
import { ShopByStyle } from './components/ShopByStyle'
import { InstagramGallery } from './components/InstagramGallery'
import { NewsletterSection } from './components/NewsletterSection'
import { Skeleton } from '@/components/ui/skeleton'

function SectionSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="aspect-[4/5] rounded-2xl" />
      ))}
    </div>
  )
}

function SectionHeader({
  eyebrow,
  title,
  to,
  linkLabel = 'View all',
}: {
  eyebrow: string
  title: string
  to: string
  linkLabel?: string
}) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4 sm:mb-10">
      <div>
        <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--sf-muted)]">{eyebrow}</p>
        <h2 className="mt-2 font-serif text-2xl text-[var(--sf-ink)] sm:text-3xl lg:text-4xl">
          {title}
        </h2>
      </div>
      <Link
        to={to}
        className="hidden items-center gap-1 text-sm font-semibold text-[var(--sf-primary)] sm:flex"
      >
        {linkLabel} <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
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

  const beautyEssentials = (featured ?? trending ?? []).slice(0, 8)
  const fashionPicks = (newArrivals ?? []).slice(0, 8)

  return (
    <div className="overflow-x-hidden">
      <DynamicHeroCarousel />
      <CategorySlider />
      <BenefitStrip />

      <section className="sf-container max-w-[1440px] py-10 lg:py-16">
        <SectionHeader
          eyebrow="Customer favorites"
          title="Best Sellers"
          to="/shop"
        />
        {l3 ? <SectionSkeleton /> : <MasonryProducts products={bestSellers ?? []} />}
      </section>

      <section className="bg-white py-10 lg:py-16">
        <div className="sf-container max-w-[1440px]">
          <SectionHeader
            eyebrow="Just dropped"
            title="New Arrivals"
            to="/category/new-arrival"
          />
          {l1 ? (
            <SectionSkeleton />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              {newArrivals?.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </section>

      {limited && limited.length > 0 ? <LimitedCollection products={limited} /> : null}

      <section className="sf-container max-w-[1440px] py-10 lg:py-16">
        {l2 ? (
          <SectionSkeleton />
        ) : (
          <ProductCarousel
            products={trending ?? []}
            title="Trending Now"
            subtitle="Most loved this week"
            autoScroll
          />
        )}
      </section>

      {beautyEssentials.length > 0 ? (
        <section className="border-y border-[var(--sf-border)] bg-[var(--sf-primary-soft)] py-10 lg:py-16">
          <div className="sf-container max-w-[1440px]">
            <SectionHeader
              eyebrow="Glow edit"
              title="Beauty Essentials"
              to="/shop"
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              {beautyEssentials.map((p) => (
                <ProductCard key={`beauty-${p.id}`} product={p} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {fashionPicks.length > 0 ? (
        <section className="sf-container max-w-[1440px] py-10 lg:py-16">
          <SectionHeader eyebrow="Wardrobe" title="Fashion Picks" to="/category/dress" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {fashionPicks.map((p) => (
              <ProductCard key={`fashion-${p.id}`} product={p} />
            ))}
          </div>
        </section>
      ) : null}

      {featured && featured.length > 0 ? <FeaturedCollection products={featured} /> : null}

      <ShopByStyle />

      <section className="bg-white py-10 lg:py-16">
        <div className="sf-container max-w-[1440px]">
          {l4 ? (
            <SectionSkeleton />
          ) : (
            <ProductCarousel
              products={recent ?? []}
              title="Recently Added"
              subtitle="Fresh from our shelves"
            />
          )}
        </div>
      </section>

      <InstagramGallery />
      <NewsletterSection />
    </div>
  )
}
