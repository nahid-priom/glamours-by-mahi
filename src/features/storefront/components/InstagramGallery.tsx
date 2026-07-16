import { INSTAGRAM_IMAGES } from '@/lib/product-images'
import { LazyImage } from './LazyImage'

export function InstagramGallery() {
  return (
    <section className="px-4 py-16 sm:px-6 lg:py-20">
      <div className="mx-auto max-w-[1400px] text-center">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#6B7280]">@glamourousbymahi</p>
        <h2 className="mt-2 font-serif text-3xl text-[#22171C]">Style Inspiration</h2>
        <div className="mt-10 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {INSTAGRAM_IMAGES.map((img, i) => (
            <div key={i} className="overflow-hidden rounded-2xl">
              <LazyImage src={img} alt={`Style inspiration ${i + 1}`} aspectRatio="square" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
