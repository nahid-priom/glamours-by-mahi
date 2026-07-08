const TESTIMONIALS = [
  {
    quote: 'The quality feels genuinely premium. My co-ord set arrived beautifully packed and fits perfectly.',
    name: 'Nusrat Jahan',
    location: 'Dhaka',
    rating: 5,
  },
  {
    quote: 'Fast COD delivery and the fabric exceeded expectations. This is my go-to for festive wear now.',
    name: 'Sadia Rahman',
    location: 'Chittagong',
    rating: 5,
  },
  {
    quote: 'Love the minimal aesthetic and thoughtful sizing. Customer support was incredibly helpful.',
    name: 'Farhana Akter',
    location: 'Sylhet',
    rating: 5,
  },
]

export function TestimonialSection() {
  return (
    <section className="border-y border-[#111111]/5 bg-[#F8F6F2] px-4 py-4 sm:px-6 lg:py-16">
      <div className="mx-auto max-w-[1400px]">
        <p className="text-center text-[11px] uppercase tracking-[0.3em] text-[#6B7280]">Reviews</p>
        <h2 className="mt-2 text-center font-serif text-3xl text-[#111111] sm:text-4xl">Loved by Our Customers</h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <blockquote
              key={t.name}
              className="rounded-2xl bg-white p-8 shadow-[0_4px_24px_-8px_rgba(17,17,17,0.08)]"
            >
              <p className="text-sm leading-relaxed text-[#6B7280]">&ldquo;{t.quote}&rdquo;</p>
              <footer className="mt-6">
                <p className="font-medium text-[#111111]">{t.name}</p>
                <p className="text-xs text-[#6B7280]">{t.location}</p>
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  )
}
